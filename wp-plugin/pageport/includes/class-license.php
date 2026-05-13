<?php
/**
 * Lifetime free-share quota + license gate (v2.3.0).
 *
 * Free users get N lifetime Smart Share uploads (default 5). After that
 * they must hold an active Inspect Page license. Until billing is wired
 * (planned) the license is a manual per-user flag set by site admins via
 * user meta `inspect_page_license` ("active" / anything-else).
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class InspectPage_License {

    const META_KEY = 'inspect_page_license';

    /** True when the user holds an active Inspect Page license. */
    public static function has_license( $user_id ) {
        $val = get_user_meta( (int) $user_id, self::META_KEY, true );
        return is_string( $val ) && strtolower( $val ) === 'active';
    }

    public static function free_limit() {
        return (int) get_option( 'inspect_page_free_lifetime_limit', 5 );
    }

    /** Total Smart Share sessions ever created by this user (any status). */
    public static function lifetime_used( $user_id ) {
        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        return (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM {$p}share_sessions WHERE user_id = %d",
            (int) $user_id
        ) );
    }

    /**
     * Returns true when the user may create another share, or a WP_Error
     * with code E_SHARE_QUOTA_FREE / status 402 when the free quota is
     * exhausted and no license is active.
     */
    public static function can_share( $user_id ) {
        if ( self::has_license( $user_id ) ) return true;
        $used  = self::lifetime_used( $user_id );
        $limit = self::free_limit();
        if ( $used >= $limit ) {
            return new WP_Error(
                InspectPage_ErrorCode::E_SHARE_QUOTA_FREE,
                sprintf(
                    'Free quota reached (%d/%d lifetime shares). Upgrade to Inspect Page Pro to keep sharing.',
                    $used, $limit
                ),
                [ 'status' => 402 ]
            );
        }
        return true;
    }

    public static function summary( $user_id ) {
        return [
            'lifetime_used' => self::lifetime_used( $user_id ),
            'free_limit'    => self::free_limit(),
            'has_license'   => self::has_license( $user_id ),
        ];
    }
}