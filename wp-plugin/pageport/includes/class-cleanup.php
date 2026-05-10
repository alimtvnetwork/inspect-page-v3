<?php
/**
 * Hourly expiry sweep. V4 stub — V5 implements the SQL + file deletes.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class PagePort_Cleanup {

    public static function run() {
        // V5: select Active rows where expires_at < NOW(), delete files, mark Expired.
    }

    public static function deactivate() {
        $ts = wp_next_scheduled( 'pageport_cleanup' );
        if ( $ts ) { wp_unschedule_event( $ts, 'pageport_cleanup' ); }
    }
}