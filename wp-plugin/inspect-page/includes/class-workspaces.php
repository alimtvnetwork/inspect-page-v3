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

    /** Invite token lifetime in seconds (7 days). */
    const INVITE_TTL = 604800;

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

    /** Lowercases and validates an email (max 190 chars to fit column). */
    public static function sanitize_email( $email ) {
        if ( ! is_string( $email ) ) { return ''; }
        $email = strtolower( trim( $email ) );
        if ( $email === '' || strlen( $email ) > 190 ) { return ''; }
        if ( function_exists( 'is_email' ) ) {
            return is_email( $email ) ? $email : '';
        }
        return filter_var( $email, FILTER_VALIDATE_EMAIL ) ? $email : '';
    }

    /** 64-char hex token (32 random bytes). */
    public static function generate_invite_token() {
        if ( function_exists( 'wp_generate_password' ) && function_exists( 'random_bytes' ) ) {
            return bin2hex( random_bytes( 32 ) );
        }
        return bin2hex( random_bytes( 32 ) );
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
    // Invites (W2)
    // ----------------------------------------------------------------------

    /** Lists pending (unaccepted, unexpired) invites for a workspace. */
    public static function list_invites( $workspace_id ) {
        global $wpdb;
        $p   = $wpdb->prefix . 'pp_';
        $now = gmdate( 'Y-m-d H:i:s' );
        $rows = $wpdb->get_results( $wpdb->prepare(
            "SELECT id, workspace_id, email, role, invited_by_user_id, created_at, expires_at, accepted_at
               FROM {$p}workspace_invites
              WHERE workspace_id = %d AND accepted_at IS NULL AND expires_at > %s
           ORDER BY created_at DESC",
            (int) $workspace_id, $now
        ) );
        $out = [];
        foreach ( (array) $rows as $r ) {
            $out[] = [
                'id'                 => (int) $r->id,
                'workspace_id'       => (int) $r->workspace_id,
                'email'              => (string) $r->email,
                'role'               => (string) $r->role,
                'invited_by_user_id' => (int) $r->invited_by_user_id,
                'created_at'         => (string) $r->created_at,
                'expires_at'         => (string) $r->expires_at,
            ];
        }
        return $out;
    }

    /** Fetches an invite by raw token, or null. */
    public static function get_invite_by_token( $token ) {
        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        $token = is_string( $token ) ? trim( $token ) : '';
        if ( $token === '' ) { return null; }
        $row = $wpdb->get_row( $wpdb->prepare(
            "SELECT id, workspace_id, email, role, invited_by_user_id, created_at, expires_at, accepted_at
               FROM {$p}workspace_invites WHERE token = %s",
            $token
        ) );
        if ( ! $row ) { return null; }
        return [
            'id'                 => (int) $row->id,
            'workspace_id'       => (int) $row->workspace_id,
            'email'              => (string) $row->email,
            'role'               => (string) $row->role,
            'invited_by_user_id' => (int) $row->invited_by_user_id,
            'created_at'         => (string) $row->created_at,
            'expires_at'         => (string) $row->expires_at,
            'accepted_at'        => $row->accepted_at ?? null,
        ];
    }

    /**
     * Creates an invite + (best-effort) emails it. Returns the invite row on
     * success or a WP_Error. Caller must already have confirmed the inviter
     * is an admin/owner of the workspace.
     */
    public static function create_invite( $workspace_id, $inviter_user_id, $email, $role ) {
        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        $ws = self::get( $workspace_id );
        if ( ! $ws ) {
            return new WP_Error( 'inspect_page.workspace.not_found', 'Workspace not found', [ 'status' => 404 ] );
        }
        $email = self::sanitize_email( $email );
        if ( $email === '' ) {
            return new WP_Error( 'inspect_page.invite.bad_email', 'A valid email is required', [ 'status' => 400 ] );
        }
        $role = self::normalize_role( $role );
        if ( $role === self::ROLE_OWNER ) {
            return new WP_Error( 'inspect_page.invite.bad_role', 'Cannot invite as owner; transfer ownership instead', [ 'status' => 400 ] );
        }

        // Already a member?
        if ( function_exists( 'get_user_by' ) ) {
            $existing = get_user_by( 'email', $email );
            if ( $existing && self::role_of( $workspace_id, (int) $existing->ID ) !== '' ) {
                return new WP_Error( 'inspect_page.invite.already_member', 'That user is already a member', [ 'status' => 409 ] );
            }
        }

        // Already an open invite for this email?
        $now      = gmdate( 'Y-m-d H:i:s' );
        $existing = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM {$p}workspace_invites
              WHERE workspace_id = %d AND email = %s AND accepted_at IS NULL AND expires_at > %s",
            (int) $workspace_id, $email, $now
        ) );
        if ( $existing ) {
            return new WP_Error( 'inspect_page.invite.duplicate', 'A pending invite already exists for that email', [ 'status' => 409 ] );
        }

        $token   = self::generate_invite_token();
        $expires = gmdate( 'Y-m-d H:i:s', time() + self::INVITE_TTL );
        $wpdb->insert( "{$p}workspace_invites", [
            'workspace_id'       => (int) $workspace_id,
            'email'              => $email,
            'role'               => $role,
            'token'              => $token,
            'invited_by_user_id' => (int) $inviter_user_id,
            'created_at'         => $now,
            'expires_at'         => $expires,
        ], [ '%d', '%s', '%s', '%s', '%d', '%s', '%s' ] );
        $invite_id = (int) $wpdb->insert_id;
        if ( $invite_id <= 0 ) {
            return new WP_Error( 'inspect_page.invite.create_failed', 'Could not create invite', [ 'status' => 500 ] );
        }

        // Best-effort email (skipped in tests where wp_mail is not defined).
        if ( function_exists( 'wp_mail' ) && function_exists( 'admin_url' ) ) {
            $accept_url = add_query_arg( [
                'page'  => 'inspect-page-accept',
                'token' => $token,
            ], admin_url( 'admin.php' ) );
            $subject = sprintf( '[Inspect Page] You have been invited to %s', $ws['name'] );
            $body    = sprintf(
                "You've been invited to join the \"%s\" workspace on Inspect Page as %s.\n\n" .
                "Accept the invite (link expires in 7 days):\n%s\n\n" .
                "If you don't have an account yet, you'll be asked to sign in first.\n",
                $ws['name'], $role, $accept_url
            );
            wp_mail( $email, $subject, $body );
        }

        return [
            'id'                 => $invite_id,
            'workspace_id'       => (int) $workspace_id,
            'email'              => $email,
            'role'               => $role,
            'invited_by_user_id' => (int) $inviter_user_id,
            'created_at'         => $now,
            'expires_at'         => $expires,
            'token'              => $token,
        ];
    }

    /** Revokes (deletes) a pending invite. */
    public static function revoke_invite( $workspace_id, $invite_id ) {
        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        $n = $wpdb->delete( "{$p}workspace_invites", [
            'id'           => (int) $invite_id,
            'workspace_id' => (int) $workspace_id,
        ], [ '%d', '%d' ] );
        return [ 'ok' => $n > 0 ];
    }

    /**
     * Accepts an invite on behalf of $user_id. The caller MUST be the
     * logged-in user accepting (the REST layer enforces that).
     */
    public static function accept_invite( $token, $user_id ) {
        global $wpdb;
        $p   = $wpdb->prefix . 'pp_';
        $now = gmdate( 'Y-m-d H:i:s' );
        $inv = self::get_invite_by_token( $token );
        if ( ! $inv ) {
            return new WP_Error( 'inspect_page.invite.invalid', 'Invalid or expired invite', [ 'status' => 404 ] );
        }
        if ( $inv['accepted_at'] !== null ) {
            return new WP_Error( 'inspect_page.invite.consumed', 'Invite already used', [ 'status' => 410 ] );
        }
        if ( strcmp( $inv['expires_at'], $now ) <= 0 ) {
            return new WP_Error( 'inspect_page.invite.expired', 'Invite has expired', [ 'status' => 410 ] );
        }

        // Email match (case-insensitive). Tests stub get_userdata; in WP we
        // also accept any logged-in user whose primary email matches.
        if ( function_exists( 'get_userdata' ) ) {
            $u = get_userdata( (int) $user_id );
            $u_email = $u && isset( $u->user_email ) ? strtolower( (string) $u->user_email ) : '';
            if ( $u_email !== '' && $u_email !== strtolower( $inv['email'] ) ) {
                return new WP_Error( 'inspect_page.invite.email_mismatch', 'Invite was sent to a different email', [ 'status' => 403 ] );
            }
        }

        // Already a member? Mark as accepted and return success.
        $existing_role = self::role_of( (int) $inv['workspace_id'], (int) $user_id );
        if ( $existing_role === '' ) {
            $wpdb->insert( "{$p}workspace_members", [
                'workspace_id' => (int) $inv['workspace_id'],
                'user_id'      => (int) $user_id,
                'role'         => $inv['role'],
                'joined_at'    => $now,
            ], [ '%d', '%d', '%s', '%s' ] );
        }
        $wpdb->update( "{$p}workspace_invites",
            [ 'accepted_at' => $now ],
            [ 'id' => (int) $inv['id'] ],
            [ '%s' ], [ '%d' ]
        );

        return [
            'ok'           => true,
            'workspace_id' => (int) $inv['workspace_id'],
            'role'         => (string) $inv['role'],
        ];
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

        register_rest_route( $ns, '/workspaces/(?P<id>\d+)/invites', [
            [
                'methods'             => 'GET',
                'callback'            => [ __CLASS__, 'rest_list_invites' ],
                'permission_callback' => [ 'InspectPage_Auth', 'require_wp_user' ],
            ],
            [
                'methods'             => 'POST',
                'callback'            => [ __CLASS__, 'rest_create_invite' ],
                'permission_callback' => [ 'InspectPage_Auth', 'require_wp_user' ],
            ],
        ] );

        register_rest_route( $ns, '/workspaces/(?P<id>\d+)/invites/(?P<invite_id>\d+)', [
            'methods'             => 'DELETE',
            'callback'            => [ __CLASS__, 'rest_revoke_invite' ],
            'permission_callback' => [ 'InspectPage_Auth', 'require_wp_user' ],
        ] );

        register_rest_route( $ns, '/workspaces/accept', [
            'methods'             => 'POST',
            'callback'            => [ __CLASS__, 'rest_accept_invite' ],
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

    public static function rest_list_invites( WP_REST_Request $req ) {
        $uid  = InspectPage_Auth::current_user_id();
        $id   = (int) $req['id'];
        $role = self::role_of( $id, $uid );
        if ( ! self::role_can_admin( $role ) ) {
            return new WP_Error( 'inspect_page.workspace.forbidden', 'Admin role required', [ 'status' => 403 ] );
        }
        return rest_ensure_response( [ 'invites' => self::list_invites( $id ) ] );
    }

    public static function rest_create_invite( WP_REST_Request $req ) {
        $uid  = InspectPage_Auth::current_user_id();
        $id   = (int) $req['id'];
        $role = self::role_of( $id, $uid );
        if ( ! self::role_can_admin( $role ) ) {
            return new WP_Error( 'inspect_page.workspace.forbidden', 'Admin role required', [ 'status' => 403 ] );
        }
        $res = self::create_invite(
            $id, $uid,
            (string) $req->get_param( 'email' ),
            (string) $req->get_param( 'role' )
        );
        if ( is_wp_error( $res ) ) { return $res; }
        // Don't leak the raw token in the list response — only in create.
        return rest_ensure_response( $res );
    }

    public static function rest_revoke_invite( WP_REST_Request $req ) {
        $uid  = InspectPage_Auth::current_user_id();
        $id   = (int) $req['id'];
        $iid  = (int) $req['invite_id'];
        $role = self::role_of( $id, $uid );
        if ( ! self::role_can_admin( $role ) ) {
            return new WP_Error( 'inspect_page.workspace.forbidden', 'Admin role required', [ 'status' => 403 ] );
        }
        return rest_ensure_response( self::revoke_invite( $id, $iid ) );
    }

    public static function rest_accept_invite( WP_REST_Request $req ) {
        $uid = InspectPage_Auth::current_user_id();
        $res = self::accept_invite( (string) $req->get_param( 'token' ), $uid );
        return is_wp_error( $res ) ? $res : rest_ensure_response( $res );
    }

    // ----------------------------------------------------------------------
    // Billing helpers (W4) — used by InspectPage_Billing
    // ----------------------------------------------------------------------

    /** Updates one or more billing columns on a workspace row. */
    public static function update_billing( $workspace_id, array $fields ) {
        global $wpdb;
        $p       = $wpdb->prefix . 'pp_';
        $allowed = [ 'license_status', 'stripe_customer_id', 'stripe_subscription_id' ];
        $data    = [];
        $format  = [];
        foreach ( $fields as $k => $v ) {
            if ( ! in_array( $k, $allowed, true ) ) { continue; }
            $data[ $k ] = $v;
            $format[]   = '%s';
        }
        if ( ! $data ) { return 0; }
        return (int) $wpdb->update( "{$p}workspaces", $data, [ 'id' => (int) $workspace_id ], $format, [ '%d' ] );
    }

    /** Looks up a workspace id by stripe_customer_id, or 0. */
    public static function find_by_stripe_customer( $customer_id ) {
        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        $customer_id = is_string( $customer_id ) ? trim( $customer_id ) : '';
        if ( $customer_id === '' ) { return 0; }
        return (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM {$p}workspaces WHERE stripe_customer_id = %s LIMIT 1",
            $customer_id
        ) );
    }

    /**
     * Picks a default workspace id for $user_id when none is supplied to a
     * billing call. Prefers a workspace the user owns; falls back to one
     * they admin; finally any membership. Returns 0 when none.
     */
    public static function default_for_user( $user_id ) {
        $list = self::list_for_user( $user_id );
        if ( ! $list ) { return 0; }
        foreach ( [ self::ROLE_OWNER, self::ROLE_ADMIN, self::ROLE_MEMBER ] as $r ) {
            foreach ( $list as $w ) {
                if ( $w['role'] === $r ) { return (int) $w['id']; }
            }
        }
        return 0;
    }

    /** Returns true when a workspace's license_status is `active`. */
    public static function has_active_license( $workspace_id ) {
        $ws = self::get( $workspace_id );
        return $ws && $ws['license_status'] === self::LICENSE_ACTIVE;
    }
}
