<?php
/**
 * Drops PagePort tables and removes uploads/pageport when the plugin is
 * deleted via wp-admin.
 */
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) { exit; }

global $wpdb;
$p = $wpdb->prefix . 'pp_';
foreach ( [ 'share_assets', 'share_sessions', 'share_session_statuses', 'share_session_kinds', 'share_asset_types' ] as $t ) {
    $wpdb->query( "DROP TABLE IF EXISTS {$p}{$t}" );
}

$ts = wp_next_scheduled( 'pageport_cleanup' );
if ( $ts ) { wp_unschedule_event( $ts, 'pageport_cleanup' ); }

$up = wp_upload_dir();
$dir = trailingslashit( $up['basedir'] ) . 'pageport';
if ( is_dir( $dir ) ) {
    require_once ABSPATH . 'wp-admin/includes/file.php';
    WP_Filesystem();
    global $wp_filesystem;
    $wp_filesystem->rmdir( $dir, true );
}