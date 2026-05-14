<?php
/**
 * Unit tests for InspectPage_Stats.
 * Run: php tests/test-stats.php
 */
if ( ! defined( 'ABSPATH' ) ) { define( 'ABSPATH', __DIR__ . '/' ); }
if ( ! defined( 'ARRAY_A' ) ) { define( 'ARRAY_A', 'ARRAY_A' ); }

// ---- WP shims -----------------------------------------------------------
$GLOBALS['_pp_options']    = [ 'inspect_page_url_secret' => 'unit-secret' ];
$GLOBALS['_pp_transients'] = [];

function get_option( $k, $d = false ) {
    return array_key_exists( $k, $GLOBALS['_pp_options'] ) ? $GLOBALS['_pp_options'][ $k ] : $d;
}
function update_option( $k, $v, $a = true ) { $GLOBALS['_pp_options'][ $k ] = $v; return true; }
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
function current_time( $type, $gmt = 0 ) { return gmdate( 'Y-m-d H:i:s' ); }
function wp_json_encode( $v ) { return json_encode( $v ); }

class WP_Error {
    public $code; public $message; public $data;
    public function __construct( $c = '', $m = '', $d = [] ) { $this->code = $c; $this->message = $m; $this->data = $d; }
}
function is_wp_error( $x ) { return $x instanceof WP_Error; }

// AssetType + ErrorCode used by class-stats.
class InspectPage_AssetType {
    const HTML = 'html'; const CSS = 'css'; const JS = 'js'; const IMAGE = 'image';
    public static function all() { return [ 'html', 'css', 'js', 'image' ]; }
}
class InspectPage_ErrorCode {
    const E_SHARE_NOT_FOUND = 'E_SHARE_NOT_FOUND';
    const E_SHARE_FORBIDDEN = 'E_SHARE_FORBIDDEN';
}

// License + user-meta shims for the event-log path.
$GLOBALS['_pp_user_meta'] = [];
$GLOBALS['_pp_pro_users'] = []; // uid => true means Pro
function get_user_meta( $uid, $key, $single = false ) {
    return $GLOBALS['_pp_user_meta'][ "$uid:$key" ] ?? '';
}
function update_user_meta( $uid, $key, $value ) {
    $GLOBALS['_pp_user_meta'][ "$uid:$key" ] = $value;
    return true;
}
class InspectPage_License {
    public static function has_license( $uid ) {
        return ! empty( $GLOBALS['_pp_pro_users'][ (int) $uid ] );
    }
}

// ---- $wpdb mock ---------------------------------------------------------
class FakeWpdb {
    public $prefix = 'wp_';
    public $rows = []; // id => row array
    public $events = [];
    public $deleted = 0;
    public function prepare( $q, ...$args ) {
        // Naive %d / %s substitution (single placeholder cases only).
        foreach ( $args as $a ) {
            $q = preg_replace( '/%d|%s/', is_int( $a ) ? (string) $a : "'" . addslashes( (string) $a ) . "'", $q, 1 );
        }
        return $q;
    }
    public function get_row( $q, $type = 0 ) {
        if ( preg_match( '/WHERE id = (\d+)/', $q, $m ) ) {
            $r = $this->rows[ (int) $m[1] ] ?? null;
            return $r ? $r : null;
        }
        if ( preg_match( "/WHERE session_id = '([^']+)'/", $q, $m ) ) {
            foreach ( $this->rows as $r ) {
                if ( $r['session_id'] === $m[1] ) return $r;
            }
            return null;
        }
        return null;
    }
    public function update( $table, $data, $where ) {
        $id = (int) $where['id'];
        if ( ! isset( $this->rows[ $id ] ) ) return false;
        foreach ( $data as $k => $v ) { $this->rows[ $id ][ $k ] = $v; }
        return 1;
    }
    public function get_var( $q ) {
        if ( preg_match( "/WHERE name = '([^']+)'/", $q, $m ) ) {
            $map = [ 'html' => 1, 'css' => 2, 'js' => 3, 'image' => 4 ];
            return isset( $map[ $m[1] ] ) ? $map[ $m[1] ] : 0;
        }
        return null;
    }
    public function insert( $table, $data ) {
        $this->events[] = $data + [ '_table' => $table ];
        return 1;
    }
    public function get_results( $q, $type = 0 ) {
        // recent_events_for_user / events_for_session queries both start with
        // "FROM wp_pp_share_events" (with optional alias `e`).
        if ( strpos( $q, 'wp_pp_share_events' ) !== false ) {
            $out = [];
            foreach ( array_reverse( $this->events ) as $e ) {
                $out[] = [
                    'created_at' => $e['created_at'] ?? '',
                    'ip_hash'    => $e['ip_hash']    ?? '',
                    'ua_hash'    => $e['ua_hash']    ?? '',
                    'kind'       => 'html',
                    'session_id' => 'sess-aaaaaaaaaaaaaaaa',
                ];
            }
            return $out;
        }
        return [];
    }
    public function query( $q ) {
        if ( strpos( $q, 'DELETE FROM wp_pp_share_events' ) !== false ) {
            $n = count( $this->events );
            $this->events = [];
            $this->deleted += $n;
            return $n;
        }
        return 0;
    }
}
$GLOBALS['wpdb'] = new FakeWpdb();
$GLOBALS['wpdb']->rows[ 1 ] = [
    'id'             => 1,
    'session_id'     => 'sess-aaaaaaaaaaaaaaaa',
    'user_id'        => 7,
    'views'          => 0,
    'views_per_file' => null,
    'last_viewed_at' => null,
];
$GLOBALS['wpdb']->rows[ 2 ] = [
    'id'             => 2,
    'session_id'     => 'sess-bbbbbbbbbbbbbbbb',
    'user_id'        => 8,
    'views'          => 0,
    'views_per_file' => null,
    'last_viewed_at' => null,
];

require __DIR__ . '/../includes/class-stats.php';

function assert_eq( $a, $b, $label ) {
    if ( $a === $b ) { echo "  ok   $label\n"; return; }
    echo "  FAIL $label  expected=" . var_export( $b, true ) . " actual=" . var_export( $a, true ) . "\n";
    exit( 1 );
}

echo "Stats: record_view increments aggregate + per-file\n";
InspectPage_Stats::record_view( 1, 'html', '1.1.1.1' );
assert_eq( $GLOBALS['wpdb']->rows[1]['views'], 1, 'first html view' );
assert_eq( json_decode( $GLOBALS['wpdb']->rows[1]['views_per_file'], true ), [ 'html' => 1 ], 'per-file map' );

echo "Stats: throttle blocks same IP+session within 60s\n";
InspectPage_Stats::record_view( 1, 'html', '1.1.1.1' );
assert_eq( $GLOBALS['wpdb']->rows[1]['views'], 1, 'second view from same IP throttled' );

echo "Stats: different IP counts separately\n";
InspectPage_Stats::record_view( 1, 'html', '2.2.2.2' );
assert_eq( $GLOBALS['wpdb']->rows[1]['views'], 2, 'distinct IP increments' );

echo "Stats: different file kinds increment separately\n";
InspectPage_Stats::record_view( 1, 'css', '1.1.1.1' );
assert_eq( $GLOBALS['wpdb']->rows[1]['views'], 3, 'css increments aggregate' );
$per = json_decode( $GLOBALS['wpdb']->rows[1]['views_per_file'], true );
assert_eq( $per['css'], 1, 'css per-file = 1' );
assert_eq( $per['html'], 2, 'html per-file = 2' );

echo "Stats: invalid kind is no-op\n";
$before = $GLOBALS['wpdb']->rows[1]['views'];
InspectPage_Stats::record_view( 1, 'bogus', '9.9.9.9' );
assert_eq( $GLOBALS['wpdb']->rows[1]['views'], $before, 'bogus kind ignored' );

echo "Stats: get_stats returns full per-file map for owner\n";
$s = InspectPage_Stats::get_stats( 'sess-aaaaaaaaaaaaaaaa', 7 );
assert_eq( is_array( $s ), true, 'returns array' );
assert_eq( $s['views'], 3, 'aggregate views' );
assert_eq( $s['per_file'], [ 'html' => 2, 'css' => 1, 'js' => 0, 'image' => 0 ], 'per-file zero-fills missing keys' );

echo "Stats: get_stats returns 403 for non-owner\n";
$err = InspectPage_Stats::get_stats( 'sess-aaaaaaaaaaaaaaaa', 999 );
assert_eq( is_wp_error( $err ), true, 'forbidden returns WP_Error' );
assert_eq( $err->code, 'E_SHARE_FORBIDDEN', 'forbidden code' );

echo "Stats: get_stats returns 404 for unknown session\n";
$err = InspectPage_Stats::get_stats( 'does-not-exist', 7 );
assert_eq( is_wp_error( $err ), true, 'not-found returns WP_Error' );
assert_eq( $err->code, 'E_SHARE_NOT_FOUND', 'not-found code' );

echo "Stats: cross-user isolation (session 2 untouched)\n";
assert_eq( $GLOBALS['wpdb']->rows[2]['views'], 0, "user 8's session not affected" );

// ---- Event log (Phase 5) ------------------------------------------------
echo "Stats: event log is OFF for free user even when opt-in flag set\n";
$GLOBALS['wpdb']->events = [];
update_user_meta( 7, 'inspect_page_event_log_optin', '1' );  // opt-in but not Pro
InspectPage_Stats::record_view( 2, 'html', '8.8.8.8' );      // session owned by user 8 (free)
update_user_meta( 8, 'inspect_page_event_log_optin', '1' );
InspectPage_Stats::record_view( 2, 'css', '8.8.8.8' );
assert_eq( count( $GLOBALS['wpdb']->events ), 0, 'no events for free user' );

echo "Stats: Pro + opt-in writes anonymized event\n";
$GLOBALS['_pp_pro_users'][8] = true; // promote user 8 to Pro
InspectPage_Stats::record_view( 2, 'js', '8.8.8.8' );
assert_eq( count( $GLOBALS['wpdb']->events ), 1, 'one event recorded' );
$evt = $GLOBALS['wpdb']->events[0];
assert_eq( strlen( $evt['ip_hash'] ), 40, 'ip_hash is 40 chars' );
assert_eq( strlen( $evt['ua_hash'] ), 40, 'ua_hash is 40 chars' );
assert_eq( $evt['session_id'], 2, 'event linked to session row 2' );
assert_eq( $evt['asset_type_id'], 3, 'asset_type_id resolved (js=3)' );

echo "Stats: Pro without opt-in does not log\n";
$GLOBALS['_pp_pro_users'][8] = true;
update_user_meta( 8, 'inspect_page_event_log_optin', '' );
$before = count( $GLOBALS['wpdb']->events );
InspectPage_Stats::record_view( 2, 'image', '8.8.8.8' );
assert_eq( count( $GLOBALS['wpdb']->events ), $before, 'opt-in off blocks event' );

echo "Stats: recent_events_for_user returns rows for owner\n";
$rows = InspectPage_Stats::recent_events_for_user( 8, 50 );
assert_eq( is_array( $rows ), true, 'returns array' );
assert_eq( count( $rows ) >= 1, true, 'has at least one row' );

echo "Stats: purge_old_events clears the table\n";
$n = InspectPage_Stats::purge_old_events();
assert_eq( $n, count( $rows ), 'purged equals previous count' );
assert_eq( count( $GLOBALS['wpdb']->events ), 0, 'events table empty' );

echo "\nAll Stats tests passed.\n";