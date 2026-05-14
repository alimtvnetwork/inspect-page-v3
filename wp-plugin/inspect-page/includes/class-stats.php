<?php
/**
 * Per-session view-counter for Smart Share public asset URLs.
 *
 * Surfaces:
 *   - InspectPage_Stats::record_view( $session_row_id, $kind )
 *       Increments aggregate + per-file counters. Throttled per
 *       (client IP, session, kind) for 60 s via transient cache so a
 *       single client reloading a tab cannot inflate the count.
 *   - InspectPage_Stats::get_stats( $session_id, $user_id )
 *       Owner-only summary used by REST GET /sessions/{id}/stats.
 *   - InspectPage_Stats::recent_events_for_user( $user_id, $limit )
 *       Pro-only opt-in event log (anonymized hashes only).
 *   - InspectPage_Stats::purge_old_events()
 *       Hourly cleanup; rolling EVENT_LOG_DAYS window.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class InspectPage_Stats {

    /** Throttle window (seconds) per IP+session+kind. */
    const THROTTLE_TTL = 60;

    /** User-meta key gating the optional event log (Pro only). */
    const OPTIN_META = 'inspect_page_event_log_optin';

    /** Rolling event-log window (days). */
    const EVENT_LOG_DAYS = 30;

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

        // Optional anonymized event log (Pro + opt-in only).
        self::maybe_record_event( $session_row_id, $kind, $client_ip, $secret );

        return true;
    }

    /**
     * Append an anonymized event row when the session owner is on Pro AND
     * has opted into the visitor log. IP + UA are HMAC-hashed with the
     * per-install URL secret so raw values never hit the database.
     */
    private static function maybe_record_event( $session_row_id, $kind, $client_ip, $secret ) {
        global $wpdb;
        $p   = $wpdb->prefix . 'pp_';
        $row = $wpdb->get_row( $wpdb->prepare(
            "SELECT user_id FROM {$p}share_sessions WHERE id = %d", (int) $session_row_id
        ), ARRAY_A );
        if ( ! $row ) { return false; }
        $owner = (int) $row['user_id'];
        if ( ! class_exists( 'InspectPage_License' ) || ! InspectPage_License::has_license( $owner ) ) {
            return false;
        }
        $optin = get_user_meta( $owner, self::OPTIN_META, true );
        if ( $optin !== '1' && $optin !== 1 && $optin !== true ) { return false; }

        $kind_id = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM {$p}share_asset_types WHERE name = %s", $kind
        ) );
        if ( ! $kind_id ) { return false; }

        $ua  = isset( $_SERVER['HTTP_USER_AGENT'] ) ? (string) $_SERVER['HTTP_USER_AGENT'] : '';
        $key = $secret ?: 'inspect-page';
        $wpdb->insert( "{$p}share_events", [
            'session_id'    => (int) $session_row_id,
            'asset_type_id' => $kind_id,
            'created_at'    => current_time( 'mysql', true ),
            'ip_hash'       => substr( hash_hmac( 'sha256', (string) $client_ip, $key ), 0, 40 ),
            'ua_hash'       => substr( hash_hmac( 'sha256', $ua, $key ), 0, 40 ),
        ] );
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

    /**
     * Recent anonymized events for sessions owned by $user_id (Pro + opt-in
     * only). Returns at most $limit rows, newest first.
     */
    public static function recent_events_for_user( $user_id, $limit = 50 ) {
        global $wpdb;
        $p     = $wpdb->prefix . 'pp_';
        $limit = max( 1, min( 200, (int) $limit ) );
        $rows  = $wpdb->get_results( $wpdb->prepare(
            "SELECT e.created_at, e.ip_hash, e.ua_hash, t.name AS kind, s.session_id
               FROM {$p}share_events e
               JOIN {$p}share_sessions s     ON s.id = e.session_id
               JOIN {$p}share_asset_types t  ON t.id = e.asset_type_id
              WHERE s.user_id = %d
              ORDER BY e.created_at DESC
              LIMIT %d",
            (int) $user_id, $limit
        ), ARRAY_A );
        return is_array( $rows ) ? $rows : [];
    }

    /** Hourly cleanup hook calls this. Returns rows deleted. */
    public static function purge_old_events() {
        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        return (int) $wpdb->query( $wpdb->prepare(
            "DELETE FROM {$p}share_events WHERE created_at < (UTC_TIMESTAMP() - INTERVAL %d DAY)",
            self::EVENT_LOG_DAYS
        ) );
    }
}