<?php
/**
 * Unit tests for InspectPage_Digest. Run: php tests/test-digest.php
 */
if ( ! defined( 'ABSPATH' ) ) { define( 'ABSPATH', __DIR__ . '/' ); }
if ( ! defined( 'DAY_IN_SECONDS' ) ) { define( 'DAY_IN_SECONDS', 86400 ); }

// ---- Minimal WP shims ---------------------------------------------------
$GLOBALS['_pp_user_meta'] = [];
$GLOBALS['_pp_users']     = [];
$GLOBALS['_pp_mail']      = [];
$GLOBALS['_pp_rows']      = [];
$GLOBALS['_pp_options']   = [];

function get_user_by( $field, $id ) { return $GLOBALS['_pp_users'][ (int) $id ] ?? false; }
function get_user_meta( $uid, $key, $single = false ) {
    return $GLOBALS['_pp_user_meta'][ "$uid:$key" ] ?? '';
}
function update_user_meta( $uid, $key, $value ) {
    $GLOBALS['_pp_user_meta'][ "$uid:$key" ] = $value; return true;
}
function delete_user_meta( $uid, $key ) {
    unset( $GLOBALS['_pp_user_meta'][ "$uid:$key" ] ); return true;
}
function update_option( $k, $v, $autoload = null ) { $GLOBALS['_pp_options'][ $k ] = $v; return true; }
function get_option( $k, $d = false ) { return $GLOBALS['_pp_options'][ $k ] ?? $d; }
function wp_mail( $to, $subj, $body ) { $GLOBALS['_pp_mail'][] = compact( 'to', 'subj', 'body' ); return true; }
function wp_generate_password( $len, $special = true, $extra = false ) {
    return substr( str_repeat( 'abcdefghijklmnopqrstuvwxyz0123456789', 4 ), 0, $len );
}
function home_url( $path = '' ) { return 'https://example.test' . $path; }
function add_action() {} function add_filter() {}
function __( $s, $d = null ) { return $s; }

// Status / license stubs.
class InspectPage_SessionStatus {
    const ACTIVE = 'active'; const EXPIRED = 'expired'; const REVOKED = 'revoked';
}
class InspectPage_License {
    const META_KEY = 'inspect_page_license';
    public static function summary( $uid ) {
        $is_pro = (string) ( $GLOBALS['_pp_user_meta'][ "$uid:inspect_page_license" ] ?? '' ) === 'active';
        return [
            'lifetime_used' => 4,
            'free_limit'    => 5,
            'has_license'   => $is_pro,
        ];
    }
}

// ---- Minimal $wpdb shim with hand-rolled query routing -------------------
class _PP_Wpdb {
    public $prefix = 'wp_';
    public $usermeta = 'wp_usermeta';
    public function prepare( $q ) { $args = func_get_args(); array_shift( $args );
        return [ 'q' => $q, 'args' => $args ];
    }
    public function get_var( $stmt ) {
        $q = is_array( $stmt ) ? $stmt['q'] : $stmt;
        $a = is_array( $stmt ) ? $stmt['args'] : [];
        if ( strpos( $q, 'share_session_statuses' ) !== false ) {
            $name = $a[0] ?? '';
            return $name === 'expired' ? 2 : ( $name === 'active' ? 1 : 0 );
        }
        if ( strpos( $q, 'usermeta' ) !== false ) {
            $key = $a[0] ?? ''; $val = $a[1] ?? '';
            foreach ( $GLOBALS['_pp_user_meta'] as $k => $v ) {
                if ( substr( $k, -strlen( ":$key" ) ) === ":$key" && $v === $val ) {
                    return (int) explode( ':', $k )[0];
                }
            }
            return 0;
        }
        return 0;
    }
    public function get_results( $stmt ) {
        return $GLOBALS['_pp_rows'];
    }
}
$GLOBALS['wpdb'] = new _PP_Wpdb();

require __DIR__ . '/../includes/class-digest.php';

// ---- Helpers ------------------------------------------------------------
function reset_state() {
    $GLOBALS['_pp_user_meta'] = [];
    $GLOBALS['_pp_mail']      = [];
    $GLOBALS['_pp_options']   = [];
    $GLOBALS['_pp_users']     = [
        7 => (object) [ 'ID' => 7, 'display_name' => 'Alice', 'user_email' => 'a@x.test' ],
        8 => (object) [ 'ID' => 8, 'display_name' => 'Bob',   'user_email' => 'b@x.test' ],
    ];
    $GLOBALS['_pp_rows'] = [
        (object) [ 'user_id' => 7, 'session_id' => 'abc', 'source_url' => 'https://x.test/a', 'expires_at' => gmdate( 'Y-m-d H:i:s', time() - 3600 ) ],
        (object) [ 'user_id' => 7, 'session_id' => 'def', 'source_url' => 'https://x.test/b', 'expires_at' => gmdate( 'Y-m-d H:i:s', time() - 7200 ) ],
        (object) [ 'user_id' => 8, 'session_id' => 'ghi', 'source_url' => 'https://x.test/c', 'expires_at' => gmdate( 'Y-m-d H:i:s', time() - 1800 ) ],
    ];
}
function assert_eq( $a, $b, $label ) {
    if ( $a === $b ) { echo "  ✓ $label\n"; return; }
    echo "  ✗ $label  expected=" . var_export( $b, true ) . " actual=" . var_export( $a, true ) . "\n";
    exit( 1 );
}
function assert_true( $a, $label ) { assert_eq( $a, true, $label ); }

// ---- Tests --------------------------------------------------------------
echo "Digest: emails one user per group of expired sessions\n";
reset_state();
$n = InspectPage_Digest::run();
assert_eq( $n, 2, 'two users emailed (Alice + Bob)' );
assert_eq( count( $GLOBALS['_pp_mail'] ), 2, 'wp_mail called twice' );
$m = $GLOBALS['_pp_mail'][0];
assert_true( strpos( $m['subj'], '2 session(s) expired' ) !== false, 'Alice subject lists 2 sessions' );
assert_true( strpos( $m['body'], 'https://x.test/a' ) !== false, 'Alice body lists URL a' );
assert_true( strpos( $m['body'], 'https://x.test/b' ) !== false, 'Alice body lists URL b' );
assert_true( strpos( $m['body'], 'inspect_page_digest_unsubscribe=' ) !== false, 'unsubscribe link present' );
assert_true( strpos( $m['body'], 'free Smart Share links' ) !== false, 'Free-tier footer present' );

echo "Digest: opted-out users are skipped\n";
reset_state();
InspectPage_Digest::set_optout( 7, true );
$n = InspectPage_Digest::run();
assert_eq( $n, 1, 'only Bob emailed' );
assert_eq( count( $GLOBALS['_pp_mail'] ), 1, 'one mail sent' );
assert_eq( $GLOBALS['_pp_mail'][0]['to'], 'b@x.test', 'Bob received it' );

echo "Digest: Pro users get the Pro footer\n";
reset_state();
update_user_meta( 7, InspectPage_License::META_KEY, 'active' );
InspectPage_Digest::run();
$alice = null;
foreach ( $GLOBALS['_pp_mail'] as $m ) { if ( $m['to'] === 'a@x.test' ) { $alice = $m; break; } }
assert_true( $alice !== null, 'Alice got a mail' );
assert_true( strpos( $alice['body'], 'Inspect Page Pro' ) !== false, 'Pro footer rendered' );
assert_true( strpos( $alice['body'], 'free Smart Share' ) === false, 'Free footer not rendered for Pro' );

echo "Digest: token round-trip\n";
reset_state();
$tok = InspectPage_Digest::token_for( 7 );
assert_true( strlen( $tok ) >= 24, 'token is at least 24 chars' );
assert_eq( InspectPage_Digest::token_for( 7 ), $tok, 'token is stable across calls' );
assert_eq( InspectPage_Digest::user_id_for_token( $tok ), 7, 'token resolves back to user' );
assert_eq( InspectPage_Digest::user_id_for_token( 'short' ), 0, 'short token rejected' );
assert_eq( InspectPage_Digest::user_id_for_token( str_repeat( 'z', 32 ) ), 0, 'unknown token returns 0' );

echo "Digest: empty when no expired sessions\n";
reset_state();
$GLOBALS['_pp_rows'] = [];
$n = InspectPage_Digest::run();
assert_eq( $n, 0, 'no users emailed' );
assert_eq( count( $GLOBALS['_pp_mail'] ), 0, 'no mail sent' );
assert_true( get_option( 'inspect_page_digest_last_run' ) > 0, 'last_run option still updated' );

echo "\nAll Digest tests passed.\n";