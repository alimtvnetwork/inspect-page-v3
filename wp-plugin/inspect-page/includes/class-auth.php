<?php
/**
 * WP-cookie + nonce permission callback for Inspect Page REST routes (v2.2).
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

final class InspectPage_Auth {

    /** Permission callback: must be a logged-in WP user with a valid wp_rest nonce. */
    public static function require_wp_user() {
        if ( ! is_user_logged_in() ) {
            return new WP_Error(
                InspectPage_ErrorCode::E_SHARE_AUTH,
                __( 'Login required.', 'inspect-page' ),
                [ 'status' => 401 ]
            );
        }
        $nonce = self::read_nonce();
        if ( ! $nonce || ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
            return new WP_Error(
                InspectPage_ErrorCode::E_SHARE_AUTH,
                __( 'Invalid or missing X-WP-Nonce.', 'inspect-page' ),
                [ 'status' => 401 ]
            );
        }
        if ( ! current_user_can( 'upload_files' ) ) {
            return new WP_Error(
                InspectPage_ErrorCode::E_SHARE_FORBIDDEN,
                __( 'Insufficient capability.', 'inspect-page' ),
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
        // Public probe — uses the WP cookie only (no nonce). Tells the
        // extension whether the user is signed in on this site and hands
        // back a fresh `wp_rest` nonce + identity for follow-up calls.
        register_rest_route( INSPECT_PAGE_REST_NS, '/auth-status', [
            'methods'             => 'GET',
            'callback'            => [ __CLASS__, 'rest_auth_status' ],
            'permission_callback' => '__return_true',
        ] );
    }

    public static function rest_auth_status() {
        if ( ! is_user_logged_in() ) {
            return new WP_REST_Response( [ 'logged_in' => false ], 200 );
        }
        return self::rest_me_payload( true );
    }

    private static function rest_me_payload( $logged_in ) {
        global $wpdb;
        $p       = $wpdb->prefix . 'pp_';
        $user    = wp_get_current_user();
        $user_id = (int) $user->ID;

        $max_active = (int) get_option( 'inspect_page_max_active_per_user', 30 );
        $max_hour   = (int) get_option( 'inspect_page_max_per_hour_per_user', 30 );

        $active_status_id = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM {$p}share_session_statuses WHERE name = %s",
            InspectPage_SessionStatus::ACTIVE
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

        $lic = InspectPage_License::summary( $user_id );
        return new WP_REST_Response( [
            'logged_in'    => (bool) $logged_in,
            'user_id'      => $user_id,
            'display_name' => $user->display_name,
            'email'        => $user->user_email,
            'nonce'        => wp_create_nonce( 'wp_rest' ),
            'quota'        => [
                'active'      => $active,
                'max_active'  => $max_active,
                'hourly_used' => $hourly,
                'max_hourly'  => $max_hour,
                'lifetime_used' => $lic['lifetime_used'],
                'free_limit'    => $lic['free_limit'],
                'has_license'   => $lic['has_license'],
            ],
        ], 200 );
    }

    /**
     * CORS allow-listing for browser extensions (chrome-extension://* /
     * moz-extension://*). Hooked from inspect-page.php on rest_api_init.
     */
    public static function send_cors_headers( $served, $result, $request ) {
        $origin = isset( $_SERVER['HTTP_ORIGIN'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_ORIGIN'] ) ) : '';
        if ( $origin && preg_match( '#^(chrome-extension|moz-extension|safari-web-extension)://[A-Za-z0-9_-]+$#', $origin ) ) {
            header( 'Access-Control-Allow-Origin: ' . $origin );
            header( 'Access-Control-Allow-Credentials: true' );
            header( 'Vary: Origin' );
            header( 'Access-Control-Allow-Headers: Content-Type, X-WP-Nonce, Authorization' );
            header( 'Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS' );
        }
        return $served;
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