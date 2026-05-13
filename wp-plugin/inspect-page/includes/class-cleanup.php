<?php
/**
 * Hourly expiry sweep. V4 stub — V5 implements the SQL + file deletes.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class InspectPage_Cleanup {

    public static function run() {
        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        $active = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM {$p}share_session_statuses WHERE name = %s",
            InspectPage_SessionStatus::ACTIVE
        ) );
        $expired = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM {$p}share_session_statuses WHERE name = %s",
            InspectPage_SessionStatus::EXPIRED
        ) );
        if ( ! $active || ! $expired ) return 0;
        $rows = $wpdb->get_results( $wpdb->prepare(
            "SELECT id, session_id, user_id FROM {$p}share_sessions
             WHERE status_id = %d AND expires_at < UTC_TIMESTAMP()
             LIMIT 500",
            $active
        ) );
        $n = 0;
        foreach ( $rows as $row ) {
            InspectPage_Storage::delete_session_files( $row->user_id, $row->session_id );
            $wpdb->update( "{$p}share_sessions", [ 'status_id' => $expired ], [ 'id' => $row->id ] );
            $n++;
        }
        // Prune old rate-limit events (> 2h) so the table stays small.
        $wpdb->query(
            "DELETE FROM {$p}rate_events WHERE created_at < (UTC_TIMESTAMP() - INTERVAL 2 HOUR)"
        );
        return $n;
    }

    public static function deactivate() {
        $ts = wp_next_scheduled( 'inspect_page_cleanup' );
        if ( $ts ) { wp_unschedule_event( $ts, 'inspect_page_cleanup' ); }
    }
}