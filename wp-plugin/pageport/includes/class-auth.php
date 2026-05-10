<?php
/**
 * Bearer-token permission_callback for PagePort REST routes.
 *
 * On success, stashes the verified pairing-token row on a static field so
 * route callbacks can read tid + user_id without re-parsing the header.
 * Falls back to logged-in WP user (capability check) for legacy admin use.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class PagePort_Auth {

    /** @var object|null */
    private static $current_token = null;
    /** @var int */
    private static $current_user_id = 0;

    public static function require_bearer() {
        $hdr = self::read_authorization_header();
        if ( $hdr && stripos( $hdr, 'Bearer ' ) === 0 ) {
            $token = trim( substr( $hdr, 7 ) );
            $row = PagePort_Pairing::verify( $token );
            if ( is_wp_error( $row ) ) { return $row; }
            self::$current_token   = $row;
            self::$current_user_id = (int) $row->user_id;
            // Make capability checks downstream work as if the user were logged in.
            wp_set_current_user( self::$current_user_id );
            return true;
        }
        return new WP_Error(
            PagePort_ErrorCode::E_SHARE_AUTH,
            __( 'Bearer pairing token required.', 'pageport' ),
            [ 'status' => 401 ]
        );
    }

    public static function current_token() { return self::$current_token; }
    public static function current_user_id() { return self::$current_user_id; }

    private static function read_authorization_header() {
        if ( function_exists( 'getallheaders' ) ) {
            foreach ( getallheaders() as $name => $value ) {
                if ( strcasecmp( $name, 'Authorization' ) === 0 ) { return $value; }
            }
        }
        if ( ! empty( $_SERVER['HTTP_AUTHORIZATION'] ) ) {
            return wp_unslash( $_SERVER['HTTP_AUTHORIZATION'] );
        }
        if ( ! empty( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ) ) {
            return wp_unslash( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] );
        }
        return null;
    }
}