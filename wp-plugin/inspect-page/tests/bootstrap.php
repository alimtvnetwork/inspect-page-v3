<?php
/**
 * Minimal WP function shims so we can unit-test pure helpers in
 * class-rest.php without booting WordPress. Only the functions that
 * sign_session_id() actually touches are stubbed.
 */
if ( ! defined( 'ABSPATH' ) ) { define( 'ABSPATH', __DIR__ . '/' ); }
if ( ! defined( 'INSPECT_PAGE_REST_NS' ) ) { define( 'INSPECT_PAGE_REST_NS', 'inspect-page/v1' ); }
if ( ! defined( 'INSPECT_PAGE_SHARE_TTL' ) ) { define( 'INSPECT_PAGE_SHARE_TTL', 86400 ); }

$GLOBALS['_pp_options'] = [];

function get_option( $key, $default = false ) {
    return array_key_exists( $key, $GLOBALS['_pp_options'] )
        ? $GLOBALS['_pp_options'][ $key ]
        : $default;
}
function update_option( $key, $value, $autoload = true ) {
    $GLOBALS['_pp_options'][ $key ] = $value;
    return true;
}
function wp_salt( $scheme = 'auth' ) {
    return 'test-salt-' . $scheme;
}
function wp_generate_password( $length = 12, $special = true, $extra = false ) {
    $alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    $out = '';
    for ( $i = 0; $i < $length; $i++ ) {
        $out .= $alphabet[ random_int( 0, strlen( $alphabet ) - 1 ) ];
    }
    return $out;
}

// Stub the surrounding class graph so class-rest.php parses.
class WP_Error {
    public $code; public $message; public $data;
    public function __construct( $c = '', $m = '', $d = [] ) { $this->code = $c; $this->message = $m; $this->data = $d; }
}
function is_wp_error( $x ) { return $x instanceof WP_Error; }

// Pull in the file under test.
require __DIR__ . '/../includes/class-rest.php';