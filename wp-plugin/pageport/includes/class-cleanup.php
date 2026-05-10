<?php
/**
 * Hourly expiry sweep. V4 stub — V5 implements the SQL + file deletes.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class PagePort_Cleanup {

    public static function run() {
        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        $active = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM {$p}share_session_statuses WHERE name = %s",
            PagePort_SessionStatus::ACTIVE
        ) );
        $expired = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM {$p}share_session_statuses WHERE name = %s",
            PagePort_SessionStatus::EXPIRED
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
            PagePort_Storage::delete_session_files( $row->user_id, $row->session_id );
            $wpdb->update( "{$p}share_sessions", [ 'status_id' => $expired ], [ 'id' => $row->id ] );
            $n++;
        }
        return $n;
    }

    public static function deactivate() {
        $ts = wp_next_scheduled( 'pageport_cleanup' );
        if ( $ts ) { wp_unschedule_event( $ts, 'pageport_cleanup' ); }
    }
}