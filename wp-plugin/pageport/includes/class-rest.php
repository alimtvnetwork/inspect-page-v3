<?php
/**
 * REST route registration. V4 ships stubs returning 501; V5 fills them in.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class PagePort_REST {

    public static function register_routes() {
        $ns = PAGEPORT_REST_NS;

        register_rest_route( $ns, '/sessions', [
            [
                'methods'             => 'POST',
                'callback'            => [ __CLASS__, 'create_session' ],
                'permission_callback' => [ __CLASS__, 'auth_can_upload' ],
            ],
            [
                'methods'             => 'GET',
                'callback'            => [ __CLASS__, 'list_sessions' ],
                'permission_callback' => [ __CLASS__, 'auth_can_upload' ],
            ],
        ] );

        register_rest_route( $ns, '/sessions/(?P<id>[A-Za-z0-9_-]{43})', [
            'methods'             => 'DELETE',
            'callback'            => [ __CLASS__, 'delete_session' ],
            'permission_callback' => [ __CLASS__, 'auth_can_upload' ],
        ] );

        register_rest_route( $ns, '/share/(?P<id>[A-Za-z0-9_-]{43})/(?P<kind>html|css|image)', [
            'methods'             => 'GET',
            'callback'            => [ __CLASS__, 'read_asset' ],
            'permission_callback' => '__return_true',
        ] );
    }

    public static function auth_can_upload() {
        if ( ! is_user_logged_in() ) {
            return new WP_Error(
                PagePort_ErrorCode::E_SHARE_AUTH,
                __( 'Authentication required.', 'pageport' ),
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

    public static function create_session( $req ) { return self::not_implemented(); }
    public static function list_sessions( $req )  { return self::not_implemented(); }
    public static function delete_session( $req ) { return self::not_implemented(); }
    public static function read_asset( $req )     { return self::not_implemented(); }

    private static function not_implemented() {
        return new WP_Error(
            'pageport_stub',
            __( 'PagePort REST stub — implementation arrives in V5.', 'pageport' ),
            [ 'status' => 501 ]
        );
    }
}