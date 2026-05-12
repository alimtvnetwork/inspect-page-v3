<?php
/**
 * REST route registration. V4 ships stubs returning 501; V5 fills them in.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class PagePort_REST {

    public static function register_routes() {
        $ns = PAGEPORT_REST_NS;

        register_rest_route( $ns, '/sessions', [
            [
                'methods'             => 'POST',
                'callback'            => [ __CLASS__, 'create_session' ],
                'permission_callback' => [ 'PagePort_Auth', 'require_wp_user' ],
            ],
            [
                'methods'             => 'GET',
                'callback'            => [ __CLASS__, 'list_sessions' ],
                'permission_callback' => [ 'PagePort_Auth', 'require_wp_user' ],
            ],
        ] );

        register_rest_route( $ns, '/sessions/(?P<id>[A-Za-z0-9_-]{43})', [
            'methods'             => 'DELETE',
            'callback'            => [ __CLASS__, 'delete_session' ],
            'permission_callback' => [ 'PagePort_Auth', 'require_wp_user' ],
        ] );

        register_rest_route( $ns, '/share/(?P<id>[A-Za-z0-9_-]{43})/(?P<kind>html|css|image)', [
            'methods'             => 'GET',
            'callback'            => [ __CLASS__, 'read_asset' ],
            'permission_callback' => '__return_true',
        ] );
    }

    public static function auth_can_upload() {
        if ( ! is_user_logged_in() ) {
            return new WP_Error(
                PagePort_ErrorCode::E_SHARE_AUTH,
                __( 'Authentication required.', 'pageport' ),
                [ 'status' => 401 ]
            );
        }
        if ( ! current_user_can( 'upload_files' ) ) {
            return new WP_Error(
                PagePort_ErrorCode::E_SHARE_FORBIDDEN,
                __( 'Insufficient capability.', 'pageport' ),
                [ 'status' => 403 ]
            );
        }
        return true;
    }

    public static function create_session( WP_REST_Request $req ) {
        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        $user_id = PagePort_Auth::current_user_id();
        // Note: per-user active + hourly quota is enforced in S3 (rest rebuild).

        $kind_name = $req->get_param( 'kind' ) ?: PagePort_SessionKind::FULL_PAGE;
        if ( ! in_array( $kind_name, PagePort_SessionKind::all(), true ) ) {
            return new WP_Error( PagePort_ErrorCode::E_SHARE_BAD_INPUT, 'bad kind', [ 'status' => 400 ] );
        }
        $files = $req->get_file_params();
        foreach ( [ 'html', 'css', 'image' ] as $k ) {
            if ( empty( $files[ $k ]['tmp_name'] ) || ! empty( $files[ $k ]['error'] ) ) {
                return new WP_Error( PagePort_ErrorCode::E_SHARE_BAD_INPUT, "missing field: $k", [ 'status' => 400 ] );
            }
        }

        $session_id = PagePort_Storage::new_session_id();
        $now = current_time( 'mysql', true );
        $exp = gmdate( 'Y-m-d H:i:s', time() + PAGEPORT_SHARE_TTL );

        $kind_id   = self::enum_id( "{$p}share_session_kinds", $kind_name );
        $status_id = self::enum_id( "{$p}share_session_statuses", PagePort_SessionStatus::ACTIVE );
        if ( ! $kind_id || ! $status_id ) {
            return new WP_Error( PagePort_ErrorCode::E_SHARE_STORAGE, 'enum lookup failed', [ 'status' => 500 ] );
        }

        $wpdb->insert( "{$p}share_sessions", [
            'session_id' => $session_id,
            'user_id'    => $user_id,
            'kind_id'    => $kind_id,
            'status_id'  => $status_id,
            'source_url' => (string) $req->get_param( 'source_url' ),
            'created_at' => $now,
            'expires_at' => $exp,
        ] );
        $row_id = (int) $wpdb->insert_id;
        if ( ! $row_id ) {
            return new WP_Error( PagePort_ErrorCode::E_SHARE_STORAGE, 'insert failed', [ 'status' => 500 ] );
        }

        foreach ( PagePort_AssetType::all() as $kind ) {
            $f = $files[ $kind ];
            $mime = ! empty( $f['type'] ) ? $f['type'] : self::guess_mime( $kind );
            $stored = PagePort_Storage::store_asset( $user_id, $session_id, $kind, $f['tmp_name'], $mime );
            if ( is_wp_error( $stored ) ) {
                PagePort_Storage::delete_session_files( $user_id, $session_id );
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

        return new WP_REST_Response( [
            'session_id' => $session_id,
            'expires_at' => gmdate( 'c', strtotime( $exp . ' UTC' ) ),
            'kind'       => $kind_name,
            'urls'       => self::asset_urls( $session_id ),
        ], 201 );
    }

    public static function list_sessions( WP_REST_Request $req ) {
        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        $user_id = PagePort_Auth::current_user_id();
        $rows = $wpdb->get_results( $wpdb->prepare(
            "SELECT s.session_id, k.name AS kind, st.name AS status, s.source_url, s.created_at, s.expires_at
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

    public static function delete_session( WP_REST_Request $req ) {
        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        $user_id = PagePort_Auth::current_user_id();
        $sid = $req['id'];
        $row = $wpdb->get_row( $wpdb->prepare(
            "SELECT id, user_id FROM {$p}share_sessions WHERE session_id = %s", $sid
        ) );
        if ( ! $row ) {
            return new WP_Error( PagePort_ErrorCode::E_SHARE_NOT_FOUND, 'not found', [ 'status' => 404 ] );
        }
        if ( (int) $row->user_id !== $user_id && ! current_user_can( 'manage_options' ) ) {
            return new WP_Error( PagePort_ErrorCode::E_SHARE_FORBIDDEN, 'forbidden', [ 'status' => 403 ] );
        }
        PagePort_Storage::delete_session_files( $row->user_id, $sid );
        $status_id = self::enum_id( "{$p}share_session_statuses", PagePort_SessionStatus::REVOKED );
        $wpdb->update( "{$p}share_sessions", [ 'status_id' => $status_id ], [ 'id' => $row->id ] );
        return new WP_REST_Response( [ 'session_id' => $sid, 'status' => 'Revoked' ], 200 );
    }

    public static function read_asset( WP_REST_Request $req ) {
        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        $sid  = $req['id'];
        $kind = $req['kind'];
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
            return new WP_Error( PagePort_ErrorCode::E_SHARE_NOT_FOUND, 'not found', [ 'status' => 404 ] );
        }
        if ( $row->status !== PagePort_SessionStatus::ACTIVE
             || strtotime( $row->expires_at . ' UTC' ) < time() ) {
            return new WP_Error( PagePort_ErrorCode::E_SHARE_EXPIRED, 'expired or revoked', [ 'status' => 404 ] );
        }
        if ( ! file_exists( $row->path ) ) {
            return new WP_Error( PagePort_ErrorCode::E_SHARE_NOT_FOUND, 'asset missing', [ 'status' => 404 ] );
        }
        // Stream raw bytes with the stored mime.
        nocache_headers();
        header( 'Content-Type: ' . $row->mime );
        header( 'Content-Length: ' . filesize( $row->path ) );
        header( 'Content-Disposition: inline' );
        header( 'X-Content-Type-Options: nosniff' );
        readfile( $row->path );
        exit;
    }

    private static function asset_urls( $session_id ) {
        $base = rest_url( PAGEPORT_REST_NS . '/share/' . $session_id );
        return [
            'html'  => $base . '/html',
            'css'   => $base . '/css',
            'image' => $base . '/image',
        ];
    }

    private static function guess_mime( $kind ) {
        switch ( $kind ) {
            case PagePort_AssetType::HTML:  return 'text/html';
            case PagePort_AssetType::CSS:   return 'text/css';
            case PagePort_AssetType::IMAGE: return 'image/png';
        }
        return 'application/octet-stream';
    }

    private static function enum_id( $table, $name ) {
        global $wpdb;
        return (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$table} WHERE name = %s", $name ) );
    }
}