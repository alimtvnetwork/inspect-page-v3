<?php
/**
 * Per-session view-counter for Smart Share public asset URLs.
 *
 * Two surfaces:
 *   - InspectPage_Stats::record_view( $session_row_id, $kind )
 *       Increments aggregate + per-file counters. Throttled per
 *       (client IP, session) for 60 s via transient cache so a single
 *       client reloading a tab cannot inflate the count.
 *   - InspectPage_Stats::get_stats( $session_id, $user_id )
 *       Owner-only summary used by REST GET /sessions/{id}/stats.
 *
 * Storage: aggregate `views`, JSON `views_per_file` and `last_viewed_at`
 * columns on `pp_share_sessions` (added by the activator on upgrade).
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class InspectPage_Stats {

    /** Throttle window (seconds) per IP+session. */
    const THROTTLE_TTL = 60;

    /**
     * Record a single view. $kind must be one of InspectPage_AssetType.
     * No-op when the throttle window is still hot for this client.
     */
    public static function record_view( $session_row_id, $kind, $client_ip = null ) {
        global $wpdb;
        $session_row_id = (int) $session_row_id;
        if ( $session_row_id <= 0 ) { return false; }
        $kind = (string) $kind;
        if ( ! in_array( $kind, InspectPage_AssetType::all(), true ) ) { return false; }

        if ( $client_ip === null ) {
            $client_ip = isset( $_SERVER['REMOTE_ADDR'] ) ? (string) $_SERVER['REMOTE_ADDR'] : '0.0.0.0';
        }
        $secret = (string) get_option( 'inspect_page_url_secret', '' );
        $hash   = hash_hmac( 'sha256', $client_ip . '|' . $session_row_id . '|' . $kind, $secret ?: 'inspect-page' );
        $key    = 'inspect_page_view_' . substr( $hash, 0, 32 );
        if ( get_transient( $key ) ) { return false; }
        set_transient( $key, 1, self::THROTTLE_TTL );

        $p   = $wpdb->prefix . 'pp_';
        $row = $wpdb->get_row( $wpdb->prepare(
            "SELECT views, views_per_file FROM {$p}share_sessions WHERE id = %d", $session_row_id
        ), ARRAY_A );
        if ( ! $row ) { return false; }

        $per = json_decode( (string) $row['views_per_file'], true );
        if ( ! is_array( $per ) ) { $per = []; }
        $per[ $kind ] = isset( $per[ $kind ] ) ? ( (int) $per[ $kind ] ) + 1 : 1;

        $wpdb->update(
            "{$p}share_sessions",
            [
                'views'          => ( (int) $row['views'] ) + 1,
                'views_per_file' => wp_json_encode( $per ),
                'last_viewed_at' => current_time( 'mysql', true ),
            ],
            [ 'id' => $session_row_id ]
        );
        return true;
    }

    /**
     * Owner-only stats lookup. Returns WP_Error on not-found / forbidden.
     */
    public static function get_stats( $session_id, $user_id ) {
        global $wpdb;
        $p   = $wpdb->prefix . 'pp_';
        $row = $wpdb->get_row( $wpdb->prepare(
            "SELECT id, user_id, views, views_per_file, last_viewed_at
             FROM {$p}share_sessions WHERE session_id = %s", (string) $session_id
        ), ARRAY_A );
        if ( ! $row ) {
            return new WP_Error( InspectPage_ErrorCode::E_SHARE_NOT_FOUND, 'not found', [ 'status' => 404 ] );
        }
        if ( (int) $row['user_id'] !== (int) $user_id ) {
            return new WP_Error( InspectPage_ErrorCode::E_SHARE_FORBIDDEN, 'forbidden', [ 'status' => 403 ] );
        }
        $per = json_decode( (string) $row['views_per_file'], true );
        if ( ! is_array( $per ) ) { $per = []; }
        // Always emit all 4 keys with 0 default so the UI can stay simple.
        $out_per = [];
        foreach ( InspectPage_AssetType::all() as $k ) {
            $out_per[ $k ] = isset( $per[ $k ] ) ? (int) $per[ $k ] : 0;
        }
        return [
            'session_id'    => (string) $session_id,
            'views'         => (int) $row['views'],
            'last_viewed_at'=> $row['last_viewed_at']
                ? gmdate( 'c', strtotime( $row['last_viewed_at'] . ' UTC' ) )
                : null,
            'per_file'      => $out_per,
        ];
    }
}