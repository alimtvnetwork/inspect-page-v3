<?php
/**
 * Creates the 5 Inspect Page tables and seeds enum rows on activation.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class InspectPage_Activator {

    public static function activate() {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $charset = $wpdb->get_charset_collate();
        $p = $wpdb->prefix . 'pp_';

        // ---- Legacy rename migration: PagePort → Inspect Page ----
        // Copy any old `pageport_*` options/meta over to the new
        // `inspect_page_*` names so existing installs survive the rebrand.
        self::migrate_legacy();

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
            views BIGINT UNSIGNED NOT NULL DEFAULT 0,
            views_per_file TEXT NULL,
            last_viewed_at DATETIME NULL,
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

        // Per-visit event log (Option A — Phase 5). Default OFF; only
        // populated when the session owner is on Pro AND has opted in via
        // user meta `inspect_page_event_log_optin`. Rolling 30-day window
        // pruned by the hourly cleanup cron.
        $sql[] = "CREATE TABLE {$p}share_events (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            session_id BIGINT UNSIGNED NOT NULL,
            asset_type_id TINYINT UNSIGNED NOT NULL,
            created_at DATETIME NOT NULL,
            ip_hash CHAR(40) NOT NULL,
            ua_hash CHAR(40) NOT NULL,
            PRIMARY KEY (id),
            KEY session_created (session_id, created_at)
        ) {$charset};";

        foreach ( $sql as $stmt ) { dbDelta( $stmt ); }

        self::seed_enum( "{$p}share_session_statuses", InspectPage_SessionStatus::all() );
        self::seed_enum( "{$p}share_session_kinds",    InspectPage_SessionKind::all() );
        self::seed_enum( "{$p}share_asset_types",      InspectPage_AssetType::all() );

        if ( false === get_option( 'inspect_page_max_active_per_user' ) ) {
            add_option( 'inspect_page_max_active_per_user', 30, '', 'no' );
        }
        if ( false === get_option( 'inspect_page_max_per_hour_per_user' ) ) {
            add_option( 'inspect_page_max_per_hour_per_user', 30, '', 'no' );
        }

        // Drop legacy pairing_tokens table + signing key option (v2.0/v2.1 → v2.2).
        $wpdb->query( "DROP TABLE IF EXISTS {$p}pairing_tokens" );
        delete_option( 'inspect_page_signing_key' );
        delete_option( 'inspect_page_max_active_per_token' );

        if ( ! wp_next_scheduled( 'inspect_page_cleanup' ) ) {
            wp_schedule_event( time() + HOUR_IN_SECONDS, 'hourly', 'inspect_page_cleanup' );
        }

        // Schedule weekly digest of expired sessions (v2.5.0). Use the
        // 'weekly' interval registered by InspectPage_Digest. First run
        // is offset by 1 day so freshly-installed sites don't email
        // immediately on activation.
        if ( ! wp_next_scheduled( InspectPage_Digest::HOOK ) ) {
            wp_schedule_event( time() + DAY_IN_SECONDS, 'weekly', InspectPage_Digest::HOOK );
        }

        // D2 — daily digest cron for Pro users on `daily` cadence.
        // Idempotent: re-activations leave existing schedule alone.
        if ( ! wp_next_scheduled( InspectPage_Digest::HOOK_DAILY ) ) {
            wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', InspectPage_Digest::HOOK_DAILY );
        }

        // Unschedule legacy cron hook if still present.
        $legacy_cron = wp_next_scheduled( 'pageport_cleanup' );
        if ( $legacy_cron ) { wp_unschedule_event( $legacy_cron, 'pageport_cleanup' ); }
    }

    private static function seed_enum( $table, $values ) {
        global $wpdb;
        foreach ( $values as $name ) {
            $wpdb->query( $wpdb->prepare(
                "INSERT IGNORE INTO {$table} (name) VALUES (%s)", $name
            ) );
        }
    }

    /**
     * One-time copy of every old `pageport_*` option / user-meta key to its
     * new `inspect_page_*` name. Safe to run on every activation — only
     * copies when the new key doesn't already exist, then deletes the old.
     * Also moves the uploads/pageport directory to uploads/inspect-page.
     */
    private static function migrate_legacy() {
        global $wpdb;

        $option_map = [
            'pageport_db_version'             => 'inspect_page_db_version',
            'pageport_max_active_per_user'    => 'inspect_page_max_active_per_user',
            'pageport_max_per_hour_per_user'  => 'inspect_page_max_per_hour_per_user',
            'pageport_free_lifetime_limit'    => 'inspect_page_free_lifetime_limit',
            'pageport_expire_hours'           => 'inspect_page_expire_hours',
            'pageport_max_uploads_per_hour'   => 'inspect_page_max_uploads_per_hour',
        ];
        foreach ( $option_map as $old => $new ) {
            $old_val = get_option( $old, null );
            if ( $old_val !== null && get_option( $new, null ) === null ) {
                add_option( $new, $old_val, '', 'no' );
            }
            delete_option( $old );
        }
        // Drop options that no longer exist in the new naming.
        delete_option( 'pageport_signing_key' );
        delete_option( 'pageport_max_active_per_token' );

        // User-meta: pageport_license → inspect_page_license.
        $rows = $wpdb->get_results(
            "SELECT user_id, meta_value FROM {$wpdb->usermeta} WHERE meta_key = 'pageport_license'"
        );
        if ( $rows ) {
            foreach ( $rows as $row ) {
                $existing = get_user_meta( (int) $row->user_id, 'inspect_page_license', true );
                if ( $existing === '' ) {
                    update_user_meta( (int) $row->user_id, 'inspect_page_license', $row->meta_value );
                }
            }
            $wpdb->query( "DELETE FROM {$wpdb->usermeta} WHERE meta_key = 'pageport_license'" );
        }

        // Move uploads/pageport → uploads/inspect-page if old exists and new doesn't.
        $up      = wp_upload_dir();
        $old_dir = trailingslashit( $up['basedir'] ) . 'pageport';
        $new_dir = trailingslashit( $up['basedir'] ) . 'inspect-page';
        if ( is_dir( $old_dir ) && ! is_dir( $new_dir ) ) {
            @rename( $old_dir, $new_dir );
        }
    }
}