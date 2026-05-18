<?php
/**
 * Standalone assertion runner for InspectPage_Workspaces (W1).
 *
 *   php wp-plugin/inspect-page/tests/test-workspaces.php
 *
 * Exits 0 on success, 1 on the first failed assertion.
 */
require __DIR__ . '/bootstrap.php';

// --- Extra shims for this suite -----------------------------------------

if ( ! function_exists( 'rest_ensure_response' ) ) {
    function rest_ensure_response( $x ) { return $x; }
}
if ( ! function_exists( 'get_user_meta' ) ) {
    function get_user_meta( $uid, $key, $single = false ) {
        return $GLOBALS['_pp_usermeta'][ "$uid:$key" ] ?? '';
    }
}
$GLOBALS['_pp_usermeta'] = [];

if ( ! function_exists( 'is_email' ) ) {
    function is_email( $e ) { return filter_var( $e, FILTER_VALIDATE_EMAIL ) ? $e : false; }
}
if ( ! function_exists( 'get_user_by' ) ) {
    function get_user_by( $field, $value ) {
        if ( $field !== 'email' ) { return false; }
        foreach ( $GLOBALS['wpdb']->rows['users'] as $u ) {
            if ( strtolower( $u->user_email ) === strtolower( (string) $value ) ) {
                return (object) [ 'ID' => (int) $u->id, 'user_email' => $u->user_email ];
            }
        }
        return false;
    }
}
if ( ! function_exists( 'get_userdata' ) ) {
    function get_userdata( $uid ) {
        return $GLOBALS['wpdb']->rows['users'][ (int) $uid ] ?? null;
    }
}

if ( ! class_exists( 'WP_REST_Request' ) ) {
    class WP_REST_Request {
        private $params = [];
        public function __construct( $params = [] ) { $this->params = $params; }
        public function get_param( $k ) { return $this->params[ $k ] ?? null; }
        public function offsetExists( $k ) { return isset( $this->params[ $k ] ); }
        public function offsetGet( $k ) { return $this->params[ $k ] ?? null; }
        public function offsetSet( $k, $v ) { $this->params[ $k ] = $v; }
        public function offsetUnset( $k ) { unset( $this->params[ $k ] ); }
    }
}
// PHP 8+ ArrayAccess shim — WP_REST_Request used via $req['id'] in production.
if ( ! interface_exists( 'ArrayAccess' ) ) { /* always present */ }

class InspectPage_Auth_Test_Stub {
    public static $uid = 1;
    public static function current_user_id() { return self::$uid; }
}
if ( ! class_exists( 'InspectPage_Auth' ) ) {
    class_alias( 'InspectPage_Auth_Test_Stub', 'InspectPage_Auth' );
}

// In-memory $wpdb. Tracks 3 tables: workspaces, members, users.
class TestWPDB {
    public $prefix = 'wp_';
    public $users  = 'wp_users';
    public $insert_id = 0;
    public $rows = [
        'workspaces' => [],
        'members'   => [],
        'invites'   => [],
        'users'     => [], // [id => (object){id, display_name, user_login, user_email}]
    ];
    private $auto = [ 'workspaces' => 0, 'invites' => 0 ];

    public function prepare( $sql, ...$args ) {
        // crude printf-style binding — good enough for our SELECTs
        if ( count( $args ) === 1 && is_array( $args[0] ) ) { $args = $args[0]; }
        $sql = preg_replace_callback( '/%d|%s/', function ( $m ) use ( &$args ) {
            $v = array_shift( $args );
            return $m[0] === '%d' ? (string) (int) $v : "'" . addslashes( (string) $v ) . "'";
        }, $sql );
        return $sql;
    }

    public function insert( $table, $data, $formats = null ) {
        $kind = $this->kind( $table );
        if ( $kind === 'workspaces' || $kind === 'invites' ) {
            $data['id'] = ++$this->auto[ $kind ];
            $this->insert_id = $data['id'];
        }
        $this->rows[ $kind ][] = $data;
        return 1;
    }

    public function update( $table, $data, $where, $formats = null, $wf = null ) {
        $kind = $this->kind( $table );
        $n = 0;
        foreach ( $this->rows[ $kind ] as &$row ) {
            $match = true;
            foreach ( $where as $k => $v ) {
                if ( ! isset( $row[ $k ] ) || (string) $row[ $k ] !== (string) $v ) { $match = false; break; }
            }
            if ( $match ) { foreach ( $data as $k => $v ) { $row[ $k ] = $v; } $n++; }
        }
        return $n;
    }

    public function delete( $table, $where, $formats = null ) {
        $kind = $this->kind( $table );
        $before = count( $this->rows[ $kind ] );
        $this->rows[ $kind ] = array_values( array_filter( $this->rows[ $kind ], function ( $row ) use ( $where ) {
            foreach ( $where as $k => $v ) {
                if ( ! isset( $row[ $k ] ) || (string) $row[ $k ] !== (string) $v ) { return true; }
            }
            return false;
        } ) );
        return $before - count( $this->rows[ $kind ] );
    }

    public function get_var( $sql ) {
        if ( preg_match( "/SELECT id FROM \S+workspace_invites\s+WHERE workspace_id = (\d+) AND email = '([^']+)' AND accepted_at IS NULL AND expires_at > '([^']+)'/s", $sql, $m ) ) {
            foreach ( $this->rows['invites'] as $r ) {
                if ( (int) $r['workspace_id'] !== (int) $m[1] ) { continue; }
                if ( strtolower( $r['email'] ) !== strtolower( $m[2] ) ) { continue; }
                if ( ! empty( $r['accepted_at'] ) ) { continue; }
                if ( strcmp( $r['expires_at'], $m[3] ) <= 0 ) { continue; }
                return (string) $r['id'];
            }
            return null;
        }
        if ( preg_match( '/SELECT COUNT\(\*\) FROM \S+workspace_members WHERE workspace_id = (\d+)/', $sql, $m ) ) {
            $ws = (int) $m[1];
            return (string) count( array_filter( $this->rows['members'], fn( $r ) => (int) $r['workspace_id'] === $ws ) );
        }
        if ( preg_match( "/SELECT role FROM \S+workspace_members WHERE workspace_id = (\d+) AND user_id = (\d+)/", $sql, $m ) ) {
            foreach ( $this->rows['members'] as $r ) {
                if ( (int) $r['workspace_id'] === (int) $m[1] && (int) $r['user_id'] === (int) $m[2] ) {
                    return $r['role'];
                }
            }
            return null;
        }
        return null;
    }

    public function get_row( $sql ) {
        if ( preg_match( '/FROM \S+workspaces WHERE id = (\d+)/', $sql, $m ) ) {
            foreach ( $this->rows['workspaces'] as $r ) {
                if ( (int) $r['id'] === (int) $m[1] ) { return (object) $r; }
            }
        }
        if ( preg_match( "/FROM \S+workspace_invites WHERE token = '([^']+)'/", $sql, $m ) ) {
            foreach ( $this->rows['invites'] as $r ) {
                if ( (string) $r['token'] === (string) $m[1] ) { return (object) $r; }
            }
        }
        return null;
    }

    public function get_results( $sql ) {
        // list_invites
        if ( preg_match( "/FROM \S+workspace_invites\s+WHERE workspace_id = (\d+) AND accepted_at IS NULL AND expires_at > '([^']+)'/s", $sql, $m ) ) {
            $ws_id = (int) $m[1];
            $now   = $m[2];
            $out = [];
            foreach ( $this->rows['invites'] as $r ) {
                if ( (int) $r['workspace_id'] !== $ws_id ) { continue; }
                if ( ! empty( $r['accepted_at'] ) ) { continue; }
                if ( strcmp( $r['expires_at'], $now ) <= 0 ) { continue; }
                $out[] = (object) $r;
            }
            return $out;
        }
        // list_for_user: JOIN by user_id
        if ( preg_match( '/FROM \S+workspace_members m\s+JOIN \S+workspaces w.+WHERE m\.user_id = (\d+)/s', $sql, $m ) ) {
            $uid = (int) $m[1];
            $out = [];
            foreach ( $this->rows['members'] as $mem ) {
                if ( (int) $mem['user_id'] !== $uid ) { continue; }
                foreach ( $this->rows['workspaces'] as $ws ) {
                    if ( (int) $ws['id'] === (int) $mem['workspace_id'] ) {
                        $out[] = (object) [
                            'id'             => $ws['id'],
                            'name'           => $ws['name'],
                            'license_status' => $ws['license_status'],
                            'role'           => $mem['role'],
                        ];
                    }
                }
            }
            return $out;
        }
        // members(): JOIN users
        if ( preg_match( '/FROM \S+workspace_members m\s+JOIN \S+users u.+WHERE m\.workspace_id = (\d+)/s', $sql, $m ) ) {
            $ws_id = (int) $m[1];
            $out = [];
            foreach ( $this->rows['members'] as $mem ) {
                if ( (int) $mem['workspace_id'] !== $ws_id ) { continue; }
                $u = $this->rows['users'][ (int) $mem['user_id'] ] ?? null;
                if ( ! $u ) { continue; }
                $out[] = (object) [
                    'user_id'      => $mem['user_id'],
                    'role'         => $mem['role'],
                    'joined_at'    => $mem['joined_at'],
                    'display_name' => $u->display_name,
                    'user_email'   => $u->user_email,
                ];
            }
            return $out;
        }
        // backfill: users without a workspace
        if ( preg_match( '/FROM \S+users u\s+WHERE u\.ID NOT IN/s', $sql ) ) {
            $assigned = array_unique( array_map( fn( $r ) => (int) $r['user_id'], $this->rows['members'] ) );
            $out = [];
            foreach ( $this->rows['users'] as $u ) {
                if ( ! in_array( (int) $u->id, $assigned, true ) ) { $out[] = $u; }
            }
            return $out;
        }
        return [];
    }

    public function get_charset_collate() { return ''; }

    private function kind( $table ) {
        if ( strpos( $table, 'workspace_members' ) !== false ) { return 'members'; }
        if ( strpos( $table, 'workspace_invites' ) !== false ) { return 'invites'; }
        if ( strpos( $table, 'workspaces' ) !== false ) { return 'workspaces'; }
        if ( strpos( $table, 'users' ) !== false )      { return 'users'; }
        throw new RuntimeException( "Unknown table: $table" );
    }
}

$wpdb = new TestWPDB();
$GLOBALS['wpdb'] = $wpdb;

require __DIR__ . '/../includes/class-workspaces.php';

// --- Test helpers --------------------------------------------------------

$failures = 0;
function check( $label, $cond ) {
    global $failures;
    if ( $cond ) { echo "  ok   $label\n"; }
    else         { echo "  FAIL $label\n"; $failures++; }
}
function seed_user( $id, $display, $email = '' ) {
    global $wpdb;
    $wpdb->rows['users'][ $id ] = (object) [
        'id'           => $id,
        'display_name' => $display,
        'user_login'   => strtolower( $display ),
        'user_email'   => $email !== '' ? $email : strtolower( $display ) . '@example.test',
    ];
}

echo "InspectPage_Workspaces\n";

// --- Pure helpers --------------------------------------------------------

check( 'roles() has 3 entries', count( InspectPage_Workspaces::roles() ) === 3 );
check( 'role_can_admin(owner)',  InspectPage_Workspaces::role_can_admin( 'owner' ) === true );
check( 'role_can_admin(admin)',  InspectPage_Workspaces::role_can_admin( 'admin' ) === true );
check( 'role_can_admin(member)', InspectPage_Workspaces::role_can_admin( 'member' ) === false );
check( 'normalize_role unknown → member', InspectPage_Workspaces::normalize_role( 'wat' ) === 'member' );
check( 'normalize_role OWNER → owner',    InspectPage_Workspaces::normalize_role( 'OWNER' ) === 'owner' );
check( 'default_name_for_user empty → My', InspectPage_Workspaces::default_name_for_user( '', '' ) === "My's workspace" );
check( 'default_name_for_user Alice → Alice', InspectPage_Workspaces::default_name_for_user( 'Alice', '' ) === "Alice's workspace" );
check( 'sanitize_name trims', InspectPage_Workspaces::sanitize_name( "  hello  " ) === 'hello' );
check( 'sanitize_name strips control chars', InspectPage_Workspaces::sanitize_name( "a\x07b" ) === 'ab' );
check( 'sanitize_name truncates to 80', strlen( InspectPage_Workspaces::sanitize_name( str_repeat( 'x', 200 ) ) ) === 80 );

// --- 3 CREATE TABLE statements -------------------------------------------

$schema = InspectPage_Workspaces::schema_sql( '' );
check( 'schema_sql returns 3 statements', count( $schema ) === 3 );
check( 'schema has workspaces',           strpos( $schema[0], 'CREATE TABLE wp_pp_workspaces' ) !== false );
check( 'schema has workspace_members',    strpos( $schema[1], 'CREATE TABLE wp_pp_workspace_members' ) !== false );
check( 'schema has workspace_invites',    strpos( $schema[2], 'CREATE TABLE wp_pp_workspace_invites' ) !== false );

// --- Backfill ------------------------------------------------------------

seed_user( 1, 'Alice', 'alice@example.test' );
seed_user( 2, 'Bob',   'bob@example.test' );
$GLOBALS['_pp_usermeta']['2:inspect_page_license'] = 'active';

$created = InspectPage_Workspaces::backfill_solo_workspaces();
check( 'backfill created 2 solo workspaces', $created === 2 );

$alice_ws = InspectPage_Workspaces::list_for_user( 1 );
check( 'Alice has 1 workspace',  count( $alice_ws ) === 1 );
check( 'Alice is owner',         $alice_ws[0]['role'] === 'owner' );
check( "Alice's workspace is free", $alice_ws[0]['license_status'] === 'free' );
check( "Alice's workspace name", $alice_ws[0]['name'] === "Alice's workspace" );

$bob_ws = InspectPage_Workspaces::list_for_user( 2 );
check( 'Bob has 1 workspace', count( $bob_ws ) === 1 );
check( 'Bob (pro) license_status=active', $bob_ws[0]['license_status'] === 'active' );

// Idempotent: second call creates nothing.
$created2 = InspectPage_Workspaces::backfill_solo_workspaces();
check( 'backfill idempotent (0 on re-run)', $created2 === 0 );

// --- create / role_of / members ------------------------------------------

seed_user( 3, 'Carol' );
$new = InspectPage_Workspaces::create( 1, 'Team Lovable' );
check( 'create returns array',          is_array( $new ) );
check( 'create name sanitised',         $new['name'] === 'Team Lovable' );
check( 'create owner = caller',         (int) $new['owner_user_id'] === 1 );
check( 'create license=free',           $new['license_status'] === 'free' );
check( 'create member_count = 1',       $new['member_count'] === 1 );

$bad = InspectPage_Workspaces::create( 1, '   ' );
check( 'create with empty name → WP_Error', is_wp_error( $bad ) );

// Add Carol as a member of the new workspace.
$wpdb->insert( 'wp_pp_workspace_members', [
    'workspace_id' => $new['id'],
    'user_id'      => 3,
    'role'         => 'member',
    'joined_at'    => '2025-01-01 00:00:00',
] );

check( 'role_of owner', InspectPage_Workspaces::role_of( $new['id'], 1 ) === 'owner' );
check( 'role_of member', InspectPage_Workspaces::role_of( $new['id'], 3 ) === 'member' );
check( 'role_of stranger empty', InspectPage_Workspaces::role_of( $new['id'], 999 ) === '' );

$members = InspectPage_Workspaces::members( $new['id'] );
check( 'members() returns 2', count( $members ) === 2 );

// --- remove_member -------------------------------------------------------

$rm = InspectPage_Workspaces::remove_member( $new['id'], 3 );
check( 'remove_member ok', is_array( $rm ) && $rm['ok'] === true );
check( 'remove_member dropped row', InspectPage_Workspaces::role_of( $new['id'], 3 ) === '' );

$rm_owner = InspectPage_Workspaces::remove_member( $new['id'], 1 );
check( 'cannot remove owner', is_wp_error( $rm_owner ) && $rm_owner->code === 'inspect_page.workspace.cannot_remove_owner' );

// --- transfer_owner ------------------------------------------------------

// Add Carol back, this time as admin.
$wpdb->insert( 'wp_pp_workspace_members', [
    'workspace_id' => $new['id'],
    'user_id'      => 3,
    'role'         => 'admin',
    'joined_at'    => '2025-01-02 00:00:00',
] );

$xfer = InspectPage_Workspaces::transfer_owner( $new['id'], 3 );
check( 'transfer_owner returns array', is_array( $xfer ) );
check( 'new owner is Carol',           (int) $xfer['owner_user_id'] === 3 );
check( 'Carol is now owner',           InspectPage_Workspaces::role_of( $new['id'], 3 ) === 'owner' );
check( 'Alice demoted to admin',       InspectPage_Workspaces::role_of( $new['id'], 1 ) === 'admin' );

$xfer_bad = InspectPage_Workspaces::transfer_owner( $new['id'], 999 );
check( 'transfer to non-member → WP_Error', is_wp_error( $xfer_bad ) );

// --- Invites (W2) --------------------------------------------------------

// Fresh workspace owned by Alice (uid 1). Carol is currently owner of $new
// after the transfer above, so make a new one to test invites cleanly.
$ws2 = InspectPage_Workspaces::create( 1, 'Invite Team' );
check( 'invite-test workspace created', is_array( $ws2 ) );

// Helper accessors
check( 'sanitize_email lowercases', InspectPage_Workspaces::sanitize_email( ' Foo@Bar.COM ' ) === 'foo@bar.com' );
check( 'sanitize_email rejects junk', InspectPage_Workspaces::sanitize_email( 'not-an-email' ) === '' );
check( 'generate_invite_token is 64 hex', preg_match( '/^[a-f0-9]{64}$/', InspectPage_Workspaces::generate_invite_token() ) === 1 );

// Happy path: create invite
$inv = InspectPage_Workspaces::create_invite( $ws2['id'], 1, 'Dan@Example.test', 'member' );
check( 'create_invite returns array', is_array( $inv ) );
check( 'invite email normalized',     $inv['email'] === 'dan@example.test' );
check( 'invite role normalized',      $inv['role']  === 'member' );
check( 'invite has 64-hex token',     preg_match( '/^[a-f0-9]{64}$/', $inv['token'] ) === 1 );

// Bad inputs
$bad_email = InspectPage_Workspaces::create_invite( $ws2['id'], 1, 'nope', 'member' );
check( 'invite bad email → WP_Error', is_wp_error( $bad_email ) );
$bad_role = InspectPage_Workspaces::create_invite( $ws2['id'], 1, 'eve@example.test', 'owner' );
check( 'invite as owner blocked',     is_wp_error( $bad_role ) && $bad_role->code === 'inspect_page.invite.bad_role' );

// Duplicate detection (same email, still pending)
$dup = InspectPage_Workspaces::create_invite( $ws2['id'], 1, 'dan@example.test', 'member' );
check( 'duplicate invite blocked', is_wp_error( $dup ) && $dup->code === 'inspect_page.invite.duplicate' );

// list_invites returns the pending one
$list = InspectPage_Workspaces::list_invites( $ws2['id'] );
check( 'list_invites returns 1 pending', count( $list ) === 1 );

// Invite an existing member → blocked
seed_user( 4, 'Dan', 'dan@example.test' );
$wpdb->insert( 'wp_pp_workspace_members', [
    'workspace_id' => $ws2['id'], 'user_id' => 4, 'role' => 'member', 'joined_at' => '2025-01-03 00:00:00',
] );
$already = InspectPage_Workspaces::create_invite( $ws2['id'], 1, 'dan@example.test', 'member' );
check( 'invite already-member blocked', is_wp_error( $already ) && $already->code === 'inspect_page.invite.already_member' );

// Revoke
$rev = InspectPage_Workspaces::revoke_invite( $ws2['id'], $inv['id'] );
check( 'revoke_invite ok',          is_array( $rev ) && $rev['ok'] === true );
check( 'list_invites empty after revoke', count( InspectPage_Workspaces::list_invites( $ws2['id'] ) ) === 0 );

// Re-invite a fresh email then accept
seed_user( 5, 'Eve', 'eve@example.test' );
$inv2 = InspectPage_Workspaces::create_invite( $ws2['id'], 1, 'eve@example.test', 'admin' );
check( 'second invite created', is_array( $inv2 ) );

// Invalid token
$acc_bad = InspectPage_Workspaces::accept_invite( str_repeat( '0', 64 ), 5 );
check( 'accept bad token → WP_Error', is_wp_error( $acc_bad ) && $acc_bad->code === 'inspect_page.invite.invalid' );

// Email mismatch (uid 1 = Alice)
$acc_mis = InspectPage_Workspaces::accept_invite( $inv2['token'], 1 );
check( 'accept email-mismatch blocked', is_wp_error( $acc_mis ) && $acc_mis->code === 'inspect_page.invite.email_mismatch' );

// Happy path accept (uid 5 = Eve, matches email)
$acc = InspectPage_Workspaces::accept_invite( $inv2['token'], 5 );
check( 'accept ok',                        is_array( $acc ) && $acc['ok'] === true );
check( 'accept workspace_id correct',      (int) $acc['workspace_id'] === (int) $ws2['id'] );
check( 'Eve now has admin role',           InspectPage_Workspaces::role_of( $ws2['id'], 5 ) === 'admin' );

// Second use of same token → consumed
$reuse = InspectPage_Workspaces::accept_invite( $inv2['token'], 5 );
check( 'reused token → consumed',          is_wp_error( $reuse ) && $reuse->code === 'inspect_page.invite.consumed' );

// --- exit ----------------------------------------------------------------

echo "\n";
if ( $failures > 0 ) { echo "FAILED: $failures assertion(s)\n"; exit( 1 ); }
echo "All workspace assertions passed.\n";
