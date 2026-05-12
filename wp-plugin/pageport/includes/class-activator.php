<?php
/**
 * Creates the 5 PagePort tables and seeds enum rows on activation.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class PagePort_Activator {

    public static function activate() {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $charset = $wpdb->get_charset_collate();
        $p = $wpdb->prefix . 'pp_';

        $sql = [];

        $sql[] = "CREATE TABLE {$p}share_session_statuses (
            id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
            name VARCHAR(20) NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY name (name)
        ) {$charset};";

        $sql[] = "CREATE TABLE {$p}share_session_kinds (
            id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
            name VARCHAR(20) NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY name (name)
        ) {$charset};";

        $sql[] = "CREATE TABLE {$p}share_asset_types (
            id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
            name VARCHAR(20) NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY name (name)
        ) {$charset};";

        $sql[] = "CREATE TABLE {$p}share_sessions (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            session_id CHAR(43) NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL,
            kind_id TINYINT UNSIGNED NOT NULL,
            status_id TINYINT UNSIGNED NOT NULL,
            source_url TEXT NULL,
            prompt TEXT NULL,
            created_at DATETIME NOT NULL,
            expires_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY session_id (session_id),
            KEY user_id (user_id),
            KEY status_expires (status_id, expires_at)
        ) {$charset};";

        $sql[] = "CREATE TABLE {$p}share_assets (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            session_id BIGINT UNSIGNED NOT NULL,
            asset_type_id TINYINT UNSIGNED NOT NULL,
            mime VARCHAR(100) NOT NULL,
            path TEXT NOT NULL,
            bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY session_id (session_id),
            UNIQUE KEY session_asset (session_id, asset_type_id)
        ) {$charset};";

        $sql[] = "CREATE TABLE {$p}rate_events (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY user_created (user_id, created_at)
        ) {$charset};";

        foreach ( $sql as $stmt ) { dbDelta( $stmt ); }

        self::seed_enum( "{$p}share_session_statuses", PagePort_SessionStatus::all() );
        self::seed_enum( "{$p}share_session_kinds",    PagePort_SessionKind::all() );
        self::seed_enum( "{$p}share_asset_types",      PagePort_AssetType::all() );

        if ( false === get_option( 'pageport_max_active_per_user' ) ) {
            add_option( 'pageport_max_active_per_user', 30, '', 'no' );
        }
        if ( false === get_option( 'pageport_max_per_hour_per_user' ) ) {
            add_option( 'pageport_max_per_hour_per_user', 30, '', 'no' );
        }

        // Drop legacy pairing_tokens table + signing key option (v2.0/v2.1 → v2.2).
        $wpdb->query( "DROP TABLE IF EXISTS {$p}pairing_tokens" );
        delete_option( 'pageport_signing_key' );
        delete_option( 'pageport_max_active_per_token' );

        if ( ! wp_next_scheduled( 'pageport_cleanup' ) ) {
            wp_schedule_event( time() + HOUR_IN_SECONDS, 'hourly', 'pageport_cleanup' );
        }
    }

    private static function seed_enum( $table, $values ) {
        global $wpdb;
        foreach ( $values as $name ) {
            $wpdb->query( $wpdb->prepare(
                "INSERT IGNORE INTO {$table} (name) VALUES (%s)", $name
            ) );
        }
    }
}