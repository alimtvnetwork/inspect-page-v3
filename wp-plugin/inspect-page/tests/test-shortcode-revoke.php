<?php
/**
 * Unit tests for InspectPage_Shortcode::maybe_handle_revoke().
 * Verifies ownership/nonce/admin-override gates and the DB update path
 * using a tiny $wpdb mock. Run: php tests/test-shortcode-revoke.php
 */
if ( ! defined( 'ABSPATH' ) ) { define( 'ABSPATH', __DIR__ . '/' ); }

// ---- WP shims -----------------------------------------------------------
$GLOBALS['_pp_logged_in']   = true;
$GLOBALS['_pp_current_uid'] = 7;
$GLOBALS['_pp_caps']        = [];   // ['manage_options' => true]
$GLOBALS['_pp_valid_nonce'] = true;
$GLOBALS['_pp_redirects']   = [];
$GLOBALS['_pp_deleted']     = [];   // [ ['uid'=>x,'sid'=>y], ... ]

function is_user_logged_in()   { return (bool) $GLOBALS['_pp_logged_in']; }
function get_current_user_id() { return (int) $GLOBALS['_pp_current_uid']; }
function current_user_can( $cap ) { return ! empty( $GLOBALS['_pp_caps'][ $cap ] ); }
function sanitize_text_field( $s ) { return is_string( $s ) ? trim( $s ) : ''; }
function wp_unslash( $s ) { return is_string( $s ) ? stripslashes( $s ) : $s; }
function wp_verify_nonce( $n, $a ) { return $GLOBALS['_pp_valid_nonce'] ? 1 : false; }
function wp_safe_redirect( $url ) { $GLOBALS['_pp_redirects'][] = $url; return true; }
function remove_query_arg( $keys, $url = null ) { return '/redirected'; }
function add_action() {}
function add_shortcode() {}
function __( $s, $d = null ) { return $s; }
function esc_html__( $s, $d = null ) { return $s; }
function esc_html( $s ) { return $s; }
function esc_attr( $s ) { return $s; }
function esc_url( $s ) { return $s; }
function wp_login_url( $r = '' ) { return '/login'; }
function is_ssl() { return false; }
function get_date_from_gmt( $d, $f ) { return $d; }
function wp_parse_url( $u, $c = -1 ) { return parse_url( $u, $c ); }
function wp_nonce_url( $u, $a ) { return $u . '&_wpnonce=test'; }
function add_query_arg( $args, $url = '' ) { return '/' . http_build_query( $args ); }

// ---- $wpdb mock ---------------------------------------------------------
class WPDB_Mock {
    public $prefix = 'wp_';
    public $rows   = [];   // session_id => (object){id,user_id}
    public $statuses = [ 'revoked' => 99 ];
    public $updates  = [];
    public function prepare( $sql, ...$args ) { return [ $sql, $args ]; }
    public function get_row( $q ) {
        $sid = $q[1][0] ?? null;
        return $this->rows[ $sid ] ?? null;
    }
    public function get_var( $q ) {
        $name = $q[1][0] ?? null;
        return $this->statuses[ $name ] ?? null;
    }
    public function update( $tbl, $set, $where ) {
        $this->updates[] = [ 'table' => $tbl, 'set' => $set, 'where' => $where ];
        return 1;
    }
}
$GLOBALS['wpdb'] = new WPDB_Mock();

// ---- Storage stub -------------------------------------------------------
class InspectPage_Storage {
    public static function delete_session_files( $uid, $sid ) {
        $GLOBALS['_pp_deleted'][] = [ 'uid' => $uid, 'sid' => $sid ];
    }
}
class InspectPage_SessionStatus {
    const REVOKED = 'revoked';
}
class InspectPage_License {
    const META_KEY = 'inspect_page_license';
    public static function summary( $uid ) { return [ 'lifetime_used'=>0,'free_limit'=>5,'has_license'=>false ]; }
}

require __DIR__ . '/../includes/class-shortcode.php';

// ---- Helpers ------------------------------------------------------------
function reset_state() {
    global $wpdb;
    $_GET                       = [];
    $GLOBALS['_pp_logged_in']   = true;
    $GLOBALS['_pp_current_uid'] = 7;
    $GLOBALS['_pp_caps']        = [];
    $GLOBALS['_pp_valid_nonce'] = true;
    $GLOBALS['_pp_redirects']   = [];
    $GLOBALS['_pp_deleted']     = [];
    $wpdb->updates              = [];
    $wpdb->rows                 = [
        'sid-mine'    => (object) [ 'id' => 11, 'user_id' => 7 ],
        'sid-other'   => (object) [ 'id' => 22, 'user_id' => 8 ],
    ];
}
function assert_eq( $a, $b, $label ) {
    if ( $a === $b ) { echo "  ✓ $label\n"; return; }
    echo "  ✗ $label  expected=" . var_export( $b, true ) . " actual=" . var_export( $a, true ) . "\n";
    exit( 1 );
}

// ---- Tests --------------------------------------------------------------
echo "Shortcode revoke: no-op when param missing\n";
reset_state();
try { InspectPage_Shortcode::maybe_handle_revoke(); } catch ( Throwable $e ) {}
assert_eq( count( $GLOBALS['_pp_deleted'] ), 0, 'no delete' );
assert_eq( count( $GLOBALS['_pp_redirects'] ), 0, 'no redirect' );

echo "Shortcode revoke: no-op when logged out\n";
reset_state();
$_GET['inspect_page_revoke'] = 'sid-mine';
$_GET['_wpnonce'] = 'x';
$GLOBALS['_pp_logged_in'] = false;
InspectPage_Shortcode::maybe_handle_revoke();
assert_eq( count( $GLOBALS['_pp_deleted'] ), 0, 'no delete' );

echo "Shortcode revoke: no-op on bad nonce\n";
reset_state();
$_GET['inspect_page_revoke'] = 'sid-mine';
$_GET['_wpnonce'] = 'bad';
$GLOBALS['_pp_valid_nonce'] = false;
InspectPage_Shortcode::maybe_handle_revoke();
assert_eq( count( $GLOBALS['_pp_deleted'] ), 0, 'no delete on bad nonce' );

echo "Shortcode revoke: cross-user blocked\n";
reset_state();
$_GET['inspect_page_revoke'] = 'sid-other';
$_GET['_wpnonce'] = 'ok';
InspectPage_Shortcode::maybe_handle_revoke();
assert_eq( count( $GLOBALS['_pp_deleted'] ), 0, 'no delete for other user' );
assert_eq( count( $GLOBALS['wpdb']->updates ), 0, 'no status update' );

echo "Shortcode revoke: admin can revoke any session\n";
reset_state();
$_GET['inspect_page_revoke'] = 'sid-other';
$_GET['_wpnonce'] = 'ok';
$GLOBALS['_pp_caps']['manage_options'] = true;
try { InspectPage_Shortcode::maybe_handle_revoke(); } catch ( Throwable $e ) {}
assert_eq( count( $GLOBALS['_pp_deleted'] ), 1, 'admin delete called' );
assert_eq( $GLOBALS['_pp_deleted'][0]['sid'], 'sid-other', 'correct sid deleted' );
assert_eq( $GLOBALS['wpdb']->updates[0]['set']['status_id'], 99, 'status flipped to revoked' );

echo "Shortcode revoke: owner can revoke own session\n";
reset_state();
$_GET['inspect_page_revoke'] = 'sid-mine';
$_GET['_wpnonce'] = 'ok';
try { InspectPage_Shortcode::maybe_handle_revoke(); } catch ( Throwable $e ) {}
assert_eq( count( $GLOBALS['_pp_deleted'] ), 1, 'owner delete called' );
assert_eq( $GLOBALS['_pp_deleted'][0]['uid'], 7, 'owner uid passed' );
assert_eq( count( $GLOBALS['_pp_redirects'] ), 1, 'redirected after revoke' );

echo "Shortcode revoke: unknown sid is no-op\n";
reset_state();
$_GET['inspect_page_revoke'] = 'sid-ghost';
$_GET['_wpnonce'] = 'ok';
InspectPage_Shortcode::maybe_handle_revoke();
assert_eq( count( $GLOBALS['_pp_deleted'] ), 0, 'no delete for unknown sid' );

echo "\nAll shortcode-revoke tests passed.\n";