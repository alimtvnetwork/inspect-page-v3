<?php
/**
 * Unit tests for InspectPage_Notify throttling/dedupe logic.
 * Run: php tests/test-notify.php
 */
if ( ! defined( 'ABSPATH' ) ) { define( 'ABSPATH', __DIR__ . '/' ); }
if ( ! defined( 'DAY_IN_SECONDS' ) ) { define( 'DAY_IN_SECONDS', 86400 ); }

// ---- Minimal WP shims ---------------------------------------------------
$GLOBALS['_pp_transients'] = [];
$GLOBALS['_pp_user_meta']  = [];
$GLOBALS['_pp_users']      = [];
$GLOBALS['_pp_mail']       = [];

function get_transient( $k ) {
    $t = $GLOBALS['_pp_transients'][ $k ] ?? null;
    if ( ! $t ) return false;
    if ( $t['exp'] < time() ) { unset( $GLOBALS['_pp_transients'][ $k ] ); return false; }
    return $t['v'];
}
function set_transient( $k, $v, $ttl ) {
    $GLOBALS['_pp_transients'][ $k ] = [ 'v' => $v, 'exp' => time() + (int) $ttl ];
    return true;
}
function get_user_by( $field, $id ) {
    return $GLOBALS['_pp_users'][ (int) $id ] ?? false;
}
function get_user_meta( $uid, $key, $single = false ) {
    return $GLOBALS['_pp_user_meta'][ "$uid:$key" ] ?? '';
}
function update_user_meta( $uid, $key, $value ) {
    $GLOBALS['_pp_user_meta'][ "$uid:$key" ] = $value;
    return true;
}
function wp_mail( $to, $subj, $body ) {
    $GLOBALS['_pp_mail'][] = compact( 'to', 'subj', 'body' );
    return true;
}
function add_action() {}
function __( $s, $d = null ) { return $s; }
function _e( $s, $d = null ) { echo $s; }

// License stub used by Notify::on_quota_blocked.
class InspectPage_License {
    const META_KEY = 'inspect_page_license';
    public static function summary( $uid ) {
        return [ 'lifetime_used' => 5, 'free_limit' => 5, 'has_license' => false ];
    }
}

require __DIR__ . '/../includes/class-notify.php';

// ---- Helpers ------------------------------------------------------------
function reset_state() {
    $GLOBALS['_pp_transients'] = [];
    $GLOBALS['_pp_user_meta']  = [];
    $GLOBALS['_pp_mail']       = [];
    $GLOBALS['_pp_users']      = [
        7 => (object) [ 'ID' => 7, 'display_name' => 'Alice', 'user_email' => 'a@x.test' ],
        8 => (object) [ 'ID' => 8, 'display_name' => 'Bob',   'user_email' => 'b@x.test' ],
    ];
}
function assert_eq( $a, $b, $label ) {
    if ( $a === $b ) { echo "  ✓ $label\n"; return; }
    echo "  ✗ $label  expected=" . var_export( $b, true ) . " actual=" . var_export( $a, true ) . "\n";
    exit( 1 );
}

// ---- Tests --------------------------------------------------------------
echo "Notify: quota-blocked throttling\n";
reset_state();
InspectPage_Notify::on_quota_blocked( 7 );
assert_eq( count( $GLOBALS['_pp_mail'] ), 1, 'first call sends mail' );
InspectPage_Notify::on_quota_blocked( 7 );
InspectPage_Notify::on_quota_blocked( 7 );
assert_eq( count( $GLOBALS['_pp_mail'] ), 1, 'subsequent calls within 24h are throttled' );
InspectPage_Notify::on_quota_blocked( 8 );
assert_eq( count( $GLOBALS['_pp_mail'] ), 2, 'different user is not throttled' );

echo "Notify: invalid user id is no-op\n";
reset_state();
InspectPage_Notify::on_quota_blocked( 0 );
InspectPage_Notify::on_quota_blocked( -1 );
assert_eq( count( $GLOBALS['_pp_mail'] ), 0, 'no mail for invalid uid' );

echo "Notify: missing user is no-op\n";
reset_state();
InspectPage_Notify::on_quota_blocked( 999 );
assert_eq( count( $GLOBALS['_pp_mail'] ), 0, 'no mail when user_by returns false' );

echo "Notify: license-flip emails once\n";
reset_state();
InspectPage_Notify::on_user_meta( 1, 7, 'inspect_page_license', 'active' );
assert_eq( count( $GLOBALS['_pp_mail'] ), 1, 'flip to active sends mail' );
InspectPage_Notify::on_user_meta( 1, 7, 'inspect_page_license', 'active' );
InspectPage_Notify::on_user_meta( 1, 7, 'inspect_page_license', 'active' );
assert_eq( count( $GLOBALS['_pp_mail'] ), 1, 'duplicate active saves are deduped' );

echo "Notify: non-active values do not email\n";
reset_state();
InspectPage_Notify::on_user_meta( 1, 7, 'inspect_page_license', 'expired' );
InspectPage_Notify::on_user_meta( 1, 7, 'inspect_page_license', '' );
InspectPage_Notify::on_user_meta( 1, 7, 'unrelated_key',         'active' );
assert_eq( count( $GLOBALS['_pp_mail'] ), 0, 'no mail for non-active or unrelated keys' );

echo "\nAll Notify tests passed.\n";