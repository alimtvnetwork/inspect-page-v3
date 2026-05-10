<?php
/**
 * Plugin Name:       PagePort
 * Plugin URI:        https://pageport.dev/
 * Description:       Share-Links backend for the PagePort Chrome extension. Hosts captured HTML / CSS / image bundles for 24 hours and exposes them via signed public URLs.
 * Version:           2.0.0
 * Requires at least: 5.6
 * Requires PHP:      7.4
 * Author:            PagePort
 * License:           MIT
 * Text Domain:       pageport
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

define( 'PAGEPORT_VERSION', '2.0.0' );
define( 'PAGEPORT_REST_NS', 'pageport/v1' );
define( 'PAGEPORT_DIR', plugin_dir_path( __FILE__ ) );
define( 'PAGEPORT_URL', plugin_dir_url( __FILE__ ) );
define( 'PAGEPORT_SHARE_TTL', DAY_IN_SECONDS ); // 24h

require_once PAGEPORT_DIR . 'includes/enums.php';
require_once PAGEPORT_DIR . 'includes/class-activator.php';
require_once PAGEPORT_DIR . 'includes/class-storage.php';
require_once PAGEPORT_DIR . 'includes/class-pairing.php';
require_once PAGEPORT_DIR . 'includes/class-auth.php';
require_once PAGEPORT_DIR . 'includes/class-rest.php';
require_once PAGEPORT_DIR . 'includes/class-cleanup.php';
if ( is_admin() ) {
    require_once PAGEPORT_DIR . 'includes/class-admin.php';
}
if ( defined( 'WP_CLI' ) && WP_CLI ) {
    require_once PAGEPORT_DIR . 'includes/class-cli.php';
}

register_activation_hook( __FILE__, [ 'PagePort_Activator', 'activate' ] );
register_deactivation_hook( __FILE__, [ 'PagePort_Cleanup', 'deactivate' ] );

add_action( 'rest_api_init', [ 'PagePort_REST', 'register_routes' ] );
add_action( 'pageport_cleanup', [ 'PagePort_Cleanup', 'run' ] );