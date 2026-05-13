<?php
/**
 * Plugin Name:       Inspect Page
 * Plugin URI:        admin.php?page=inspect-page
 * Description:       Share-Links backend for the Inspect Page Chrome extension. Hosts captured HTML / CSS / image bundles for 24 hours and exposes them via signed public URLs.
 * Version:           2.3.0
 * Requires at least: 5.6
 * Requires PHP:      7.4
 * Author:            Inspect Page
 * Author URI:        admin.php?page=inspect-page
 * License:           MIT
 * Text Domain:       inspect-page
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

define( 'INSPECT_PAGE_VERSION', '2.3.0' );
define( 'INSPECT_PAGE_REST_NS', 'inspect-page/v1' );
define( 'INSPECT_PAGE_DIR', plugin_dir_path( __FILE__ ) );
define( 'INSPECT_PAGE_URL', plugin_dir_url( __FILE__ ) );
define( 'INSPECT_PAGE_SHARE_TTL', DAY_IN_SECONDS ); // 24h

require_once INSPECT_PAGE_DIR . 'includes/enums.php';
require_once INSPECT_PAGE_DIR . 'includes/class-activator.php';
require_once INSPECT_PAGE_DIR . 'includes/class-storage.php';
require_once INSPECT_PAGE_DIR . 'includes/class-auth.php';
require_once INSPECT_PAGE_DIR . 'includes/class-license.php';
require_once INSPECT_PAGE_DIR . 'includes/class-rest.php';
require_once INSPECT_PAGE_DIR . 'includes/class-cleanup.php';
if ( is_admin() ) {
    require_once INSPECT_PAGE_DIR . 'includes/class-admin.php';
}
if ( defined( 'WP_CLI' ) && WP_CLI ) {
    require_once INSPECT_PAGE_DIR . 'includes/class-cli.php';
}

register_activation_hook( __FILE__, [ 'InspectPage_Activator', 'activate' ] );
register_deactivation_hook( __FILE__, [ 'InspectPage_Cleanup', 'deactivate' ] );

add_action( 'rest_api_init', [ 'InspectPage_REST', 'register_routes' ] );
add_action( 'rest_api_init', [ 'InspectPage_Auth', 'register_routes' ] );
add_filter( 'rest_pre_serve_request', [ 'InspectPage_Auth', 'send_cors_headers' ], 10, 3 );
add_action( 'inspect_page_cleanup', [ 'InspectPage_Cleanup', 'run' ] );

// Run schema upgrade when the plugin file version is newer than what's stored.
add_action( 'plugins_loaded', function () {
    if ( get_option( 'inspect_page_db_version' ) !== INSPECT_PAGE_VERSION ) {
        InspectPage_Activator::activate();
        update_option( 'inspect_page_db_version', INSPECT_PAGE_VERSION, false );
    }
} );