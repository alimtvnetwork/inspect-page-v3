<?php
/**
 * REST routes for Inspect Page Smart Share (v2.2).
 *
 * Authenticated routes (cookie + X-WP-Nonce):
 *   POST   /inspect-page/v1/sessions
 *   GET    /inspect-page/v1/sessions
 *   DELETE /inspect-page/v1/sessions/{id}
 *
 * Public routes (no auth, served as raw bytes):
 *   GET /inspect-page/v1/share/{id}/index.html
 *   GET /inspect-page/v1/share/{id}/style.css
 *   GET /inspect-page/v1/share/{id}/script.js
 *   GET /inspect-page/v1/share/{id}/preview.png
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class InspectPage_REST {

    /** Map public URL slug → AssetType. */
    const SLUGS = [
        'index.html'  => InspectPage_AssetType::HTML,
        'style.css'   => InspectPage_AssetType::CSS,
        'script.js'   => InspectPage_AssetType::JS,
        'preview.png' => InspectPage_AssetType::IMAGE,
    ];

    const MAX_TEXT_BYTES  = 262144;   // 256 KB for html/css/js
    const MAX_IMAGE_BYTES = 5242880;  // 5 MB

    public static function register_routes() {
        $ns = INSPECT_PAGE_REST_NS;

        register_rest_route( $ns, '/sessions', [
            [
                'methods'             => 'POST',
                'callback'            => [ __CLASS__, 'create_session' ],
                'permission_callback' => [ 'InspectPage_Auth', 'require_wp_user' ],
            ],
            [
                'methods'             => 'GET',
                'callback'            => [ __CLASS__, 'list_sessions' ],
                'permission_callback' => [ 'InspectPage_Auth', 'require_wp_user' ],
            ],
        ] );

        register_rest_route( $ns, '/sessions/(?P<id>[A-Za-z0-9_-]{16,64})', [
            'methods'             => 'DELETE',
            'callback'            => [ __CLASS__, 'delete_session' ],
            'permission_callback' => [ 'InspectPage_Auth', 'require_wp_user' ],
        ] );

        register_rest_route(
            $ns,
            '/share/(?P<id>[A-Za-z0-9_-]{16,64})/(?P<slug>index\.html|style\.css|script\.js|preview\.png)',
            [
                'methods'             => 'GET',
                'callback'            => [ __CLASS__, 'read_asset' ],
                'permission_callback' => '__return_true',
            ]
        );
    }

    // ----------------------------------------------------------------------
    // POST /sessions
    // ----------------------------------------------------------------------
    public static function create_session( WP_REST_Request $req ) {
        global $wpdb;
        $p       = $wpdb->prefix . 'pp_';
        $user_id = InspectPage_Auth::current_user_id();

        // ---- Lifetime free quota / license gate ----
        $can = InspectPage_License::can_share( $user_id );
        if ( is_wp_error( $can ) ) { return $can; }

        // ---- Quota: active + hourly ----
        $max_active = (int) get_option( 'inspect_page_max_active_per_user', 30 );
        $max_hour   = (int) get_option( 'inspect_page_max_per_hour_per_user', 30 );
        $active_status_id = self::enum_id( "{$p}share_session_statuses", InspectPage_SessionStatus::ACTIVE );
        $active = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM {$p}share_sessions
             WHERE user_id = %d AND status_id = %d AND expires_at > UTC_TIMESTAMP()",
            $user_id, $active_status_id
        ) );
        if ( $active >= $max_active ) {
            return new WP_Error(
                InspectPage_ErrorCode::E_SHARE_QUOTA,
                sprintf( 'Active session quota reached (%d). Revoke old sessions first.', $max_active ),
                [ 'status' => 429 ]
            );
        }
        $hourly = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM {$p}rate_events
             WHERE user_id = %d AND created_at > (UTC_TIMESTAMP() - INTERVAL 1 HOUR)",
            $user_id
        ) );
        if ( $hourly >= $max_hour ) {
            return new WP_Error(
                InspectPage_ErrorCode::E_SHARE_QUOTA,
                sprintf( 'Hourly share quota reached (%d/h). Try again later.', $max_hour ),
                [ 'status' => 429 ]
            );
        }

        // ---- Validate kind + uploaded files ----
        $kind_name = $req->get_param( 'kind' ) ?: InspectPage_SessionKind::FULL_PAGE;
        if ( ! in_array( $kind_name, InspectPage_SessionKind::all(), true ) ) {
            return new WP_Error( InspectPage_ErrorCode::E_SHARE_BAD_INPUT, 'bad kind', [ 'status' => 400 ] );
        }

        $files = $req->get_file_params();
        foreach ( [ 'html', 'css', 'js', 'image' ] as $k ) {
            if ( empty( $files[ $k ]['tmp_name'] ) || ! empty( $files[ $k ]['error'] ) ) {
                return new WP_Error(
                    InspectPage_ErrorCode::E_SHARE_BAD_INPUT,
                    "missing field: $k",
                    [ 'status' => 400 ]
                );
            }
            $size = isset( $files[ $k ]['size'] ) ? (int) $files[ $k ]['size'] : @filesize( $files[ $k ]['tmp_name'] );
            $max  = ( $k === 'image' ) ? self::MAX_IMAGE_BYTES : self::MAX_TEXT_BYTES;
            if ( $size > $max ) {
                return new WP_Error(
                    InspectPage_ErrorCode::E_SHARE_BAD_INPUT,
                    sprintf( '%s exceeds %d bytes', $k, $max ),
                    [ 'status' => 413 ]
                );
            }
        }

        // ---- EXIF strip the image (re-encode via WP image editor) ----
        $image_mime = ! empty( $files['image']['type'] ) ? $files['image']['type'] : 'image/png';
        $stripped   = self::strip_exif( $files['image']['tmp_name'], $image_mime );
        if ( ! is_wp_error( $stripped ) ) {
            $files['image']['tmp_name'] = $stripped['path'];
            $files['image']['type']     = $stripped['mime'];
            $image_mime                 = $stripped['mime'];
        }

        // ---- Create session row ----
        $session_id = InspectPage_Storage::new_session_id();
        $now = current_time( 'mysql', true );
        $exp = gmdate( 'Y-m-d H:i:s', time() + INSPECT_PAGE_SHARE_TTL );

        $kind_id   = self::enum_id( "{$p}share_session_kinds", $kind_name );
        $status_id = $active_status_id;
        if ( ! $kind_id || ! $status_id ) {
            return new WP_Error( InspectPage_ErrorCode::E_SHARE_STORAGE, 'enum lookup failed', [ 'status' => 500 ] );
        }

        $prompt = (string) $req->get_param( 'prompt' );
        if ( strlen( $prompt ) > 4000 ) { $prompt = substr( $prompt, 0, 4000 ); }

        $wpdb->insert( "{$p}share_sessions", [
            'session_id' => $session_id,
            'user_id'    => $user_id,
            'kind_id'    => $kind_id,
            'status_id'  => $status_id,
            'source_url' => (string) $req->get_param( 'source_url' ),
            'prompt'     => $prompt,
            'created_at' => $now,
            'expires_at' => $exp,
        ] );
        $row_id = (int) $wpdb->insert_id;
        if ( ! $row_id ) {
            return new WP_Error( InspectPage_ErrorCode::E_SHARE_STORAGE, 'insert failed', [ 'status' => 500 ] );
        }

        // ---- Persist all 4 assets ----
        foreach ( InspectPage_AssetType::all() as $kind ) {
            $f    = $files[ $kind ];
            $mime = ! empty( $f['type'] ) ? $f['type'] : self::guess_mime( $kind );
            $stored = InspectPage_Storage::store_asset( $user_id, $session_id, $kind, $f['tmp_name'], $mime );
            if ( is_wp_error( $stored ) ) {
                InspectPage_Storage::delete_session_files( $user_id, $session_id );
                $wpdb->delete( "{$p}share_sessions", [ 'id' => $row_id ] );
                return $stored;
            }
            $wpdb->insert( "{$p}share_assets", [
                'session_id'    => $row_id,
                'asset_type_id' => self::enum_id( "{$p}share_asset_types", $kind ),
                'mime'          => $stored['mime'],
                'path'          => $stored['path'],
                'bytes'         => $stored['bytes'],
                'created_at'    => $now,
            ] );
        }

        // ---- Record rate event ----
        $wpdb->insert( "{$p}rate_events", [
            'user_id'    => $user_id,
            'created_at' => $now,
        ] );

        return new WP_REST_Response( [
            'session_id' => $session_id,
            'expires_at' => gmdate( 'c', strtotime( $exp . ' UTC' ) ),
            'kind'       => $kind_name,
            'urls'       => self::asset_urls( $session_id ),
        ], 201 );
    }

    // ----------------------------------------------------------------------
    // GET /sessions
    // ----------------------------------------------------------------------
    public static function list_sessions( WP_REST_Request $req ) {
        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        $user_id = InspectPage_Auth::current_user_id();
        $rows = $wpdb->get_results( $wpdb->prepare(
            "SELECT s.session_id, k.name AS kind, st.name AS status, s.source_url, s.prompt,
                    s.created_at, s.expires_at
             FROM {$p}share_sessions s
             JOIN {$p}share_session_kinds k    ON k.id  = s.kind_id
             JOIN {$p}share_session_statuses st ON st.id = s.status_id
             WHERE s.user_id = %d
             ORDER BY s.created_at DESC
             LIMIT 200", $user_id
        ), ARRAY_A );
        foreach ( $rows as &$r ) {
            $r['urls'] = self::asset_urls( $r['session_id'] );
        }
        return new WP_REST_Response( $rows, 200 );
    }

    // ----------------------------------------------------------------------
    // DELETE /sessions/{id}
    // ----------------------------------------------------------------------
    public static function delete_session( WP_REST_Request $req ) {
        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        $user_id = InspectPage_Auth::current_user_id();
        $sid = $req['id'];
        $row = $wpdb->get_row( $wpdb->prepare(
            "SELECT id, user_id FROM {$p}share_sessions WHERE session_id = %s", $sid
        ) );
        if ( ! $row ) {
            return new WP_Error( InspectPage_ErrorCode::E_SHARE_NOT_FOUND, 'not found', [ 'status' => 404 ] );
        }
        if ( (int) $row->user_id !== $user_id && ! current_user_can( 'manage_options' ) ) {
            return new WP_Error( InspectPage_ErrorCode::E_SHARE_FORBIDDEN, 'forbidden', [ 'status' => 403 ] );
        }
        InspectPage_Storage::delete_session_files( $row->user_id, $sid );
        $status_id = self::enum_id( "{$p}share_session_statuses", InspectPage_SessionStatus::REVOKED );
        $wpdb->update( "{$p}share_sessions", [ 'status_id' => $status_id ], [ 'id' => $row->id ] );
        return new WP_REST_Response( [ 'session_id' => $sid, 'status' => 'Revoked' ], 200 );
    }

    // ----------------------------------------------------------------------
    // GET /share/{id}/{slug}
    // ----------------------------------------------------------------------
    public static function read_asset( WP_REST_Request $req ) {
        global $wpdb;
        $p    = $wpdb->prefix . 'pp_';
        $sid  = $req['id'];
        $slug = $req['slug'];
        if ( ! isset( self::SLUGS[ $slug ] ) ) {
            return new WP_Error( InspectPage_ErrorCode::E_SHARE_NOT_FOUND, 'unknown asset', [ 'status' => 404 ] );
        }
        $kind = self::SLUGS[ $slug ];

        $row = $wpdb->get_row( $wpdb->prepare(
            "SELECT s.id, s.user_id, st.name AS status, s.expires_at, a.path, a.mime
             FROM {$p}share_sessions s
             JOIN {$p}share_session_statuses st ON st.id = s.status_id
             JOIN {$p}share_assets a            ON a.session_id = s.id
             JOIN {$p}share_asset_types t       ON t.id = a.asset_type_id
             WHERE s.session_id = %s AND t.name = %s LIMIT 1",
            $sid, $kind
        ) );
        if ( ! $row ) {
            return new WP_Error( InspectPage_ErrorCode::E_SHARE_NOT_FOUND, 'not found', [ 'status' => 404 ] );
        }
        if ( $row->status !== InspectPage_SessionStatus::ACTIVE
             || strtotime( $row->expires_at . ' UTC' ) < time() ) {
            return new WP_Error( InspectPage_ErrorCode::E_SHARE_EXPIRED, 'expired or revoked', [ 'status' => 404 ] );
        }
        if ( ! file_exists( $row->path ) ) {
            return new WP_Error( InspectPage_ErrorCode::E_SHARE_NOT_FOUND, 'asset missing', [ 'status' => 404 ] );
        }

        // Serve raw bytes with correct headers.
        header_remove( 'Cache-Control' );
        header_remove( 'Pragma' );
        header_remove( 'Expires' );
        header( 'Content-Type: ' . self::content_type_for( $kind, $row->mime ) );
        header( 'Content-Length: ' . filesize( $row->path ) );
        header( 'Content-Disposition: inline' );
        header( 'X-Content-Type-Options: nosniff' );
        header( 'Cache-Control: public, max-age=300' );
        header( 'Access-Control-Allow-Origin: *' );
        header( 'Access-Control-Allow-Methods: GET, OPTIONS' );
        readfile( $row->path );
        exit;
    }

    // ----------------------------------------------------------------------
    // helpers
    // ----------------------------------------------------------------------
    private static function asset_urls( $session_id ) {
        $base = rest_url( INSPECT_PAGE_REST_NS . '/share/' . $session_id );
        return [
            'html'  => $base . '/index.html',
            'css'   => $base . '/style.css',
            'js'    => $base . '/script.js',
            'image' => $base . '/preview.png',
        ];
    }

    private static function content_type_for( $kind, $stored_mime ) {
        switch ( $kind ) {
            case InspectPage_AssetType::HTML:  return 'text/html; charset=utf-8';
            case InspectPage_AssetType::CSS:   return 'text/css; charset=utf-8';
            case InspectPage_AssetType::JS:    return 'application/javascript; charset=utf-8';
            case InspectPage_AssetType::IMAGE:
                if ( strpos( (string) $stored_mime, 'jpeg' ) !== false ) return 'image/jpeg';
                if ( strpos( (string) $stored_mime, 'webp' ) !== false ) return 'image/webp';
                return 'image/png';
        }
        return 'application/octet-stream';
    }

    private static function guess_mime( $kind ) {
        switch ( $kind ) {
            case InspectPage_AssetType::HTML:  return 'text/html';
            case InspectPage_AssetType::CSS:   return 'text/css';
            case InspectPage_AssetType::JS:    return 'application/javascript';
            case InspectPage_AssetType::IMAGE: return 'image/png';
        }
        return 'application/octet-stream';
    }

    private static function enum_id( $table, $name ) {
        global $wpdb;
        return (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$table} WHERE name = %s", $name ) );
    }

    /**
     * Re-encode an image through the WP image editor to drop EXIF and any
     * non-pixel payload. Returns ['path' => abs, 'mime' => string] or WP_Error.
     * On failure, callers fall back to the original tmp file (best-effort).
     */
    private static function strip_exif( $tmp_path, $mime ) {
        if ( ! function_exists( 'wp_get_image_editor' ) ) {
            require_once ABSPATH . 'wp-admin/includes/image.php';
        }
        $editor = wp_get_image_editor( $tmp_path );
        if ( is_wp_error( $editor ) ) { return $editor; }

        // Normalise output mime: png stays png, jpeg stays jpeg, anything else
        // becomes png (safest cross-browser default).
        $out_mime = ( strpos( (string) $mime, 'jpeg' ) !== false ) ? 'image/jpeg' : 'image/png';
        $ext      = ( $out_mime === 'image/jpeg' ) ? '.jpg' : '.png';
        $dest     = wp_tempnam( 'inspect-page-img-' . $ext );
        if ( ! $dest ) { return new WP_Error( 'pp_tmp', 'tempnam failed' ); }
        // wp_tempnam appends .tmp; rename to enforce extension so editor picks format.
        $dest_final = $dest . $ext;
        @rename( $dest, $dest_final );

        $saved = $editor->save( $dest_final, $out_mime );
        if ( is_wp_error( $saved ) ) { @unlink( $dest_final ); return $saved; }
        return [ 'path' => $saved['path'], 'mime' => $out_mime ];
    }
}