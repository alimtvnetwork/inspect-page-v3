<?php
/**
 * Inspect Page — Team Workspaces (W1)
 *
 * Schema, helpers, and REST routes for multi-tenant workspaces.
 * Every WP user belongs to at least one workspace (their solo workspace,
 * backfilled on activation). Sessions, quotas, and billing live on
 * workspaces. Roles are owner / admin / member.
 *
 * REST routes (cookie + X-WP-Nonce):
 *   GET    /inspect-page/v1/workspaces
 *   POST   /inspect-page/v1/workspaces                  { name }
 *   GET    /inspect-page/v1/workspaces/{id}
 *   DELETE /inspect-page/v1/workspaces/{id}/members/{user_id}
 *   POST   /inspect-page/v1/workspaces/{id}/transfer-owner { user_id }
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class InspectPage_Workspaces {

    const ROLE_OWNER  = 'owner';
    const ROLE_ADMIN  = 'admin';
    const ROLE_MEMBER = 'member';

    const LICENSE_FREE     = 'free';
    const LICENSE_ACTIVE   = 'active';
    const LICENSE_PAST_DUE = 'past_due';
    const LICENSE_CANCELED = 'canceled';

    /** @return string[] */
    public static function roles() {
        return [ self::ROLE_OWNER, self::ROLE_ADMIN, self::ROLE_MEMBER ];
    }

    /** Returns true when $role grants admin-or-better powers. */
    public static function role_can_admin( $role ) {
        return $role === self::ROLE_OWNER || $role === self::ROLE_ADMIN;
    }

    /** Normalises a role string, defaulting to `member`. */
    public static function normalize_role( $role ) {
        $role = is_string( $role ) ? strtolower( trim( $role ) ) : '';
        return in_array( $role, self::roles(), true ) ? $role : self::ROLE_MEMBER;
    }

    /** Default workspace name for a user (used by backfill + first-login). */
    public static function default_name_for_user( $display_name, $user_login = '' ) {
        $base = is_string( $display_name ) && $display_name !== '' ? $display_name : $user_login;
        $base = is_string( $base ) ? trim( $base ) : '';
        if ( $base === '' ) { $base = 'My'; }
        return $base . "'s workspace";
    }

    /** Validates a workspace name (1-80 chars, no control chars). */
    public static function sanitize_name( $name ) {
        if ( ! is_string( $name ) ) { return ''; }
        $name = trim( preg_replace( '/[\x00-\x1F\x7F]/', '', $name ) );
        if ( $name === '' ) { return ''; }
        if ( function_exists( 'mb_substr' ) ) {
            return mb_substr( $name, 0, 80 );
        }
        return substr( $name, 0, 80 );
    }

    // ----------------------------------------------------------------------
    // Schema
    // ----------------------------------------------------------------------

    public static function table_workspaces() { global $wpdb; return $wpdb->prefix . 'pp_workspaces'; }
    public static function table_members()    { global $wpdb; return $wpdb->prefix . 'pp_workspace_members'; }
    public static function table_invites()    { global $wpdb; return $wpdb->prefix . 'pp_workspace_invites'; }

    /** Returns the three CREATE TABLE statements for dbDelta. */
    public static function schema_sql( $charset ) {
        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        return [
            "CREATE TABLE {$p}workspaces (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                name VARCHAR(80) NOT NULL,
                owner_user_id BIGINT UNSIGNED NOT NULL,
                license_status VARCHAR(20) NOT NULL DEFAULT 'free',
                stripe_customer_id VARCHAR(64) NULL,
                stripe_subscription_id VARCHAR(64) NULL,
                created_at DATETIME NOT NULL,
                PRIMARY KEY (id),
                KEY owner_user_id (owner_user_id)
            ) {$charset};",
            "CREATE TABLE {$p}workspace_members (
                workspace_id BIGINT UNSIGNED NOT NULL,
                user_id BIGINT UNSIGNED NOT NULL,
                role VARCHAR(20) NOT NULL,
                joined_at DATETIME NOT NULL,
                PRIMARY KEY (workspace_id, user_id),
                KEY user_id (user_id)
            ) {$charset};",
            "CREATE TABLE {$p}workspace_invites (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                workspace_id BIGINT UNSIGNED NOT NULL,
                email VARCHAR(190) NOT NULL,
                role VARCHAR(20) NOT NULL,
                token CHAR(64) NOT NULL,
                invited_by_user_id BIGINT UNSIGNED NOT NULL,
                created_at DATETIME NOT NULL,
                expires_at DATETIME NOT NULL,
                accepted_at DATETIME NULL,
                PRIMARY KEY (id),
                UNIQUE KEY token (token),
                KEY workspace_email (workspace_id, email)
            ) {$charset};",
        ];
    }

    /**
     * Backfill: for every WP user that does not yet belong to any workspace,
     * create a solo workspace owned by them and seed `license_status` from
     * their legacy `inspect_page_license` user-meta. Idempotent.
     */
    public static function backfill_solo_workspaces() {
        global $wpdb;
        $p   = $wpdb->prefix . 'pp_';
        $now = gmdate( 'Y-m-d H:i:s' );

        $rows = $wpdb->get_results(
            "SELECT u.ID AS id, u.display_name, u.user_login
               FROM {$wpdb->users} u
              WHERE u.ID NOT IN (SELECT user_id FROM {$p}workspace_members)"
        );
        if ( ! $rows ) { return 0; }

        $created = 0;
        foreach ( $rows as $row ) {
            $uid     = (int) $row->id;
            $license = get_user_meta( $uid, 'inspect_page_license', true );
            $license = $license === self::LICENSE_ACTIVE ? self::LICENSE_ACTIVE : self::LICENSE_FREE;
            $name    = self::default_name_for_user( $row->display_name, $row->user_login );

            $wpdb->insert(
                "{$p}workspaces",
                [
                    'name'           => $name,
                    'owner_user_id'  => $uid,
                    'license_status' => $license,
                    'created_at'     => $now,
                ],
                [ '%s', '%d', '%s', '%s' ]
            );
            $ws_id = (int) $wpdb->insert_id;
            if ( $ws_id <= 0 ) { continue; }

            $wpdb->insert(
                "{$p}workspace_members",
                [
                    'workspace_id' => $ws_id,
                    'user_id'      => $uid,
                    'role'         => self::ROLE_OWNER,
                    'joined_at'    => $now,
                ],
                [ '%d', '%d', '%s', '%s' ]
            );
            $created++;
        }
        return $created;
    }

    // ----------------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------------

    /** @return array<int,array{id:int,name:string,role:string,license_status:string}> */
    public static function list_for_user( $user_id ) {
        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        $rows = $wpdb->get_results( $wpdb->prepare(
            "SELECT w.id, w.name, w.license_status, m.role
               FROM {$p}workspace_members m
               JOIN {$p}workspaces w ON w.id = m.workspace_id
              WHERE m.user_id = %d
           ORDER BY w.created_at ASC, w.id ASC",
            (int) $user_id
        ) );
        $out = [];
        foreach ( (array) $rows as $r ) {
            $out[] = [
                'id'             => (int) $r->id,
                'name'           => (string) $r->name,
                'role'           => (string) $r->role,
                'license_status' => (string) $r->license_status,
            ];
        }
        return $out;
    }

    /** Returns the user's role string in $workspace_id, or '' if not a member. */
    public static function role_of( $workspace_id, $user_id ) {
        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        $role = $wpdb->get_var( $wpdb->prepare(
            "SELECT role FROM {$p}workspace_members WHERE workspace_id = %d AND user_id = %d",
            (int) $workspace_id, (int) $user_id
        ) );
        return is_string( $role ) ? $role : '';
    }

    public static function get( $workspace_id ) {
        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        $row = $wpdb->get_row( $wpdb->prepare(
            "SELECT id, name, owner_user_id, license_status, stripe_customer_id, stripe_subscription_id, created_at
               FROM {$p}workspaces WHERE id = %d",
            (int) $workspace_id
        ) );
        if ( ! $row ) { return null; }
        return [
            'id'                     => (int) $row->id,
            'name'                   => (string) $row->name,
            'owner_user_id'          => (int) $row->owner_user_id,
            'license_status'         => (string) $row->license_status,
            'stripe_customer_id'     => $row->stripe_customer_id     ?? null,
            'stripe_subscription_id' => $row->stripe_subscription_id ?? null,
            'created_at'             => (string) $row->created_at,
            'member_count'           => self::member_count( (int) $row->id ),
        ];
    }

    public static function member_count( $workspace_id ) {
        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        return (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM {$p}workspace_members WHERE workspace_id = %d",
            (int) $workspace_id
        ) );
    }

    public static function members( $workspace_id ) {
        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        $rows = $wpdb->get_results( $wpdb->prepare(
            "SELECT m.user_id, m.role, m.joined_at, u.display_name, u.user_email
               FROM {$p}workspace_members m
               JOIN {$wpdb->users} u ON u.ID = m.user_id
              WHERE m.workspace_id = %d
           ORDER BY FIELD(m.role, 'owner','admin','member'), m.joined_at ASC",
            (int) $workspace_id
        ) );
        $out = [];
        foreach ( (array) $rows as $r ) {
            $out[] = [
                'user_id'      => (int) $r->user_id,
                'role'         => (string) $r->role,
                'joined_at'    => (string) $r->joined_at,
                'display_name' => (string) $r->display_name,
                'email'        => (string) $r->user_email,
            ];
        }
        return $out;
    }

    public static function create( $owner_user_id, $name ) {
        global $wpdb;
        $p    = $wpdb->prefix . 'pp_';
        $now  = gmdate( 'Y-m-d H:i:s' );
        $name = self::sanitize_name( $name );
        if ( $name === '' ) {
            return new WP_Error( 'inspect_page.workspace.bad_name', 'Workspace name is required', [ 'status' => 400 ] );
        }
        $wpdb->insert( "{$p}workspaces", [
            'name'           => $name,
            'owner_user_id'  => (int) $owner_user_id,
            'license_status' => self::LICENSE_FREE,
            'created_at'     => $now,
        ], [ '%s', '%d', '%s', '%s' ] );
        $ws_id = (int) $wpdb->insert_id;
        if ( $ws_id <= 0 ) {
            return new WP_Error( 'inspect_page.workspace.create_failed', 'Could not create workspace', [ 'status' => 500 ] );
        }
        $wpdb->insert( "{$p}workspace_members", [
            'workspace_id' => $ws_id,
            'user_id'      => (int) $owner_user_id,
            'role'         => self::ROLE_OWNER,
            'joined_at'    => $now,
        ], [ '%d', '%d', '%s', '%s' ] );
        return self::get( $ws_id );
    }

    public static function remove_member( $workspace_id, $user_id ) {
        global $wpdb;
        $p   = $wpdb->prefix . 'pp_';
        $row = self::get( $workspace_id );
        if ( ! $row ) {
            return new WP_Error( 'inspect_page.workspace.not_found', 'Workspace not found', [ 'status' => 404 ] );
        }
        if ( (int) $row['owner_user_id'] === (int) $user_id ) {
            return new WP_Error( 'inspect_page.workspace.cannot_remove_owner', 'Owner cannot be removed; transfer ownership first', [ 'status' => 409 ] );
        }
        $wpdb->delete( "{$p}workspace_members", [
            'workspace_id' => (int) $workspace_id,
            'user_id'      => (int) $user_id,
        ], [ '%d', '%d' ] );
        return [ 'ok' => true ];
    }

    public static function transfer_owner( $workspace_id, $new_owner_user_id ) {
        global $wpdb;
        $p   = $wpdb->prefix . 'pp_';
        $row = self::get( $workspace_id );
        if ( ! $row ) {
            return new WP_Error( 'inspect_page.workspace.not_found', 'Workspace not found', [ 'status' => 404 ] );
        }
        $new_role = self::role_of( $workspace_id, $new_owner_user_id );
        if ( $new_role === '' ) {
            return new WP_Error( 'inspect_page.workspace.not_member', 'Target user is not a workspace member', [ 'status' => 400 ] );
        }
        $old_owner = (int) $row['owner_user_id'];
        $wpdb->update( "{$p}workspaces",
            [ 'owner_user_id' => (int) $new_owner_user_id ],
            [ 'id' => (int) $workspace_id ],
            [ '%d' ], [ '%d' ]
        );
        $wpdb->update( "{$p}workspace_members",
            [ 'role' => self::ROLE_OWNER ],
            [ 'workspace_id' => (int) $workspace_id, 'user_id' => (int) $new_owner_user_id ],
            [ '%s' ], [ '%d', '%d' ]
        );
        if ( $old_owner !== (int) $new_owner_user_id ) {
            $wpdb->update( "{$p}workspace_members",
                [ 'role' => self::ROLE_ADMIN ],
                [ 'workspace_id' => (int) $workspace_id, 'user_id' => $old_owner ],
                [ '%s' ], [ '%d', '%d' ]
            );
        }
        return self::get( $workspace_id );
    }

    // ----------------------------------------------------------------------
    // REST
    // ----------------------------------------------------------------------

    public static function register_routes() {
        $ns = INSPECT_PAGE_REST_NS;

        register_rest_route( $ns, '/workspaces', [
            [
                'methods'             => 'GET',
                'callback'            => [ __CLASS__, 'rest_list' ],
                'permission_callback' => [ 'InspectPage_Auth', 'require_wp_user' ],
            ],
            [
                'methods'             => 'POST',
                'callback'            => [ __CLASS__, 'rest_create' ],
                'permission_callback' => [ 'InspectPage_Auth', 'require_wp_user' ],
            ],
        ] );

        register_rest_route( $ns, '/workspaces/(?P<id>\d+)', [
            'methods'             => 'GET',
            'callback'            => [ __CLASS__, 'rest_get' ],
            'permission_callback' => [ 'InspectPage_Auth', 'require_wp_user' ],
        ] );

        register_rest_route( $ns, '/workspaces/(?P<id>\d+)/members/(?P<user_id>\d+)', [
            'methods'             => 'DELETE',
            'callback'            => [ __CLASS__, 'rest_remove_member' ],
            'permission_callback' => [ 'InspectPage_Auth', 'require_wp_user' ],
        ] );

        register_rest_route( $ns, '/workspaces/(?P<id>\d+)/transfer-owner', [
            'methods'             => 'POST',
            'callback'            => [ __CLASS__, 'rest_transfer_owner' ],
            'permission_callback' => [ 'InspectPage_Auth', 'require_wp_user' ],
        ] );
    }

    public static function rest_list( WP_REST_Request $req ) {
        $uid = InspectPage_Auth::current_user_id();
        return rest_ensure_response( [ 'workspaces' => self::list_for_user( $uid ) ] );
    }

    public static function rest_create( WP_REST_Request $req ) {
        $uid = InspectPage_Auth::current_user_id();
        $res = self::create( $uid, (string) $req->get_param( 'name' ) );
        return is_wp_error( $res ) ? $res : rest_ensure_response( $res );
    }

    public static function rest_get( WP_REST_Request $req ) {
        $uid  = InspectPage_Auth::current_user_id();
        $id   = (int) $req['id'];
        $role = self::role_of( $id, $uid );
        if ( $role === '' ) {
            return new WP_Error( 'inspect_page.workspace.forbidden', 'Not a member of this workspace', [ 'status' => 403 ] );
        }
        $ws = self::get( $id );
        if ( ! $ws ) {
            return new WP_Error( 'inspect_page.workspace.not_found', 'Workspace not found', [ 'status' => 404 ] );
        }
        $ws['role']    = $role;
        $ws['members'] = self::role_can_admin( $role ) ? self::members( $id ) : null;
        return rest_ensure_response( $ws );
    }

    public static function rest_remove_member( WP_REST_Request $req ) {
        $uid  = InspectPage_Auth::current_user_id();
        $id   = (int) $req['id'];
        $tgt  = (int) $req['user_id'];
        $role = self::role_of( $id, $uid );
        if ( ! self::role_can_admin( $role ) ) {
            return new WP_Error( 'inspect_page.workspace.forbidden', 'Admin role required', [ 'status' => 403 ] );
        }
        $res = self::remove_member( $id, $tgt );
        return is_wp_error( $res ) ? $res : rest_ensure_response( $res );
    }

    public static function rest_transfer_owner( WP_REST_Request $req ) {
        $uid  = InspectPage_Auth::current_user_id();
        $id   = (int) $req['id'];
        $tgt  = (int) $req->get_param( 'user_id' );
        $ws   = self::get( $id );
        if ( ! $ws ) {
            return new WP_Error( 'inspect_page.workspace.not_found', 'Workspace not found', [ 'status' => 404 ] );
        }
        if ( (int) $ws['owner_user_id'] !== $uid ) {
            return new WP_Error( 'inspect_page.workspace.forbidden', 'Only the owner can transfer ownership', [ 'status' => 403 ] );
        }
        $res = self::transfer_owner( $id, $tgt );
        return is_wp_error( $res ) ? $res : rest_ensure_response( $res );
    }
}
