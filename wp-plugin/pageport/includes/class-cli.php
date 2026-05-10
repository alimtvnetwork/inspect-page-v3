<?php
/**
 * WP-CLI: `wp pageport cleanup` for ad-hoc expiry sweeps.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
if ( ! ( defined( 'WP_CLI' ) && WP_CLI ) ) { return; }

final class PagePort_CLI {

    /** Run the hourly expiry sweep immediately. */
    public function cleanup( $args, $assoc_args ) {
        $n = PagePort_Cleanup::run();
        WP_CLI::success( "Expired {$n} session(s)." );
    }
}

WP_CLI::add_command( 'pageport', 'PagePort_CLI' );