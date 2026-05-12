<?php
/**
 * WP-cookie + nonce permission callback for PagePort REST routes (v2.2).
 *
 * The extension authenticates by:
 *   1. Letting the user log in via the WordPress login screen in a popup
 *      window. WP sets the auth cookie on the WP origin.
 *   2. The popup hands a fresh `wp_rest` nonce to the extension via
 *      postMessage from the bridge admin page (see class-admin.php).
 *   3. Subsequent REST calls send the cookie (credentials: 'include')
 *      plus `X-WP-Nonce: <nonce>`. wp_validate_auth_cookie + nonce check
 *      below confirm both.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class PagePort_Auth {

    /** Permission callback: must be a logged-in WP user with a valid wp_rest nonce. */
    public static function require_wp_user() {
        if ( ! is_user_logged_in() ) {
            return new WP_Error(
                PagePort_ErrorCode::E_SHARE_AUTH,
                __( 'Login required.', 'pageport' ),
                [ 'status' => 401 ]
            );
        }
        $nonce = self::read_nonce();
        if ( ! $nonce || ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
            return new WP_Error(
                PagePort_ErrorCode::E_SHARE_AUTH,
                __( 'Invalid or missing X-WP-Nonce.', 'pageport' ),
                [ 'status' => 401 ]
            );
        }
        if ( ! current_user_can( 'upload_files' ) ) {
            return new WP_Error(
                PagePort_ErrorCode::E_SHARE_FORBIDDEN,
                __( 'Insufficient capability.', 'pageport' ),
                [ 'status' => 403 ]
            );
        }
        return true;
    }

    public static function current_user_id() {
        return (int) get_current_user_id();
    }

    /** Register the auth-related REST route(s). Called from rest_api_init. */
    public static function register_routes() {
        register_rest_route( PAGEPORT_REST_NS, '/me', [
            'methods'             => 'GET',
            'callback'            => [ __CLASS__, 'rest_me' ],
            'permission_callback' => [ __CLASS__, 'require_wp_user' ],
        ] );
    }

    public static function rest_me() {
        global $wpdb;
        $p       = $wpdb->prefix . 'pp_';
        $user    = wp_get_current_user();
        $user_id = (int) $user->ID;

        $max_active = (int) get_option( 'pageport_max_active_per_user', 30 );
        $max_hour   = (int) get_option( 'pageport_max_per_hour_per_user', 30 );

        $active_status_id = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM {$p}share_session_statuses WHERE name = %s",
            PagePort_SessionStatus::ACTIVE
        ) );
        $active = $active_status_id ? (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM {$p}share_sessions
             WHERE user_id = %d AND status_id = %d AND expires_at > UTC_TIMESTAMP()",
            $user_id, $active_status_id
        ) ) : 0;
        $hourly = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM {$p}rate_events
             WHERE user_id = %d AND created_at > (UTC_TIMESTAMP() - INTERVAL 1 HOUR)",
            $user_id
        ) );

        return new WP_REST_Response( [
            'user_id'      => $user_id,
            'display_name' => $user->display_name,
            'email'        => $user->user_email,
            'nonce'        => wp_create_nonce( 'wp_rest' ),
            'quota'        => [
                'active'      => $active,
                'max_active'  => $max_active,
                'hourly_used' => $hourly,
                'max_hourly'  => $max_hour,
            ],
        ], 200 );
    }

    private static function read_nonce() {
        if ( ! empty( $_SERVER['HTTP_X_WP_NONCE'] ) ) {
            return sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_WP_NONCE'] ) );
        }
        if ( function_exists( 'getallheaders' ) ) {
            foreach ( getallheaders() as $name => $value ) {
                if ( strcasecmp( $name, 'X-WP-Nonce' ) === 0 ) {
                    return sanitize_text_field( $value );
                }
            }
        }
        return null;
    }
}