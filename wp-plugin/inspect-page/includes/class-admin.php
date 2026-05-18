<?php
/**
 * wp-admin → Tools → Inspect Page Sessions screen.
 * Lists current user's sessions (admins see everyone) and exposes a revoke action.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

if ( ! class_exists( 'WP_List_Table' ) ) {
    require_once ABSPATH . 'wp-admin/includes/class-wp-list-table.php';
}

final class InspectPage_Sessions_Table extends WP_List_Table {

    public function __construct() {
        parent::__construct( [
            'singular' => 'session',
            'plural'   => 'sessions',
            'ajax'     => false,
        ] );
    }

    public function get_columns() {
        return [
            'cb'         => '<input type="checkbox" />',
            'session_id' => __( 'Session', 'inspect-page' ),
            'user'       => __( 'User', 'inspect-page' ),
            'kind'       => __( 'Kind', 'inspect-page' ),
            'status'     => __( 'Status', 'inspect-page' ),
            'source_url' => __( 'Source URL', 'inspect-page' ),
            'created_at' => __( 'Created (UTC)', 'inspect-page' ),
            'expires_at' => __( 'Expires (UTC)', 'inspect-page' ),
            'views'      => __( 'Views', 'inspect-page' ),
            'urls'       => __( 'Public URLs', 'inspect-page' ),
        ];
    }

    protected function column_cb( $item ) {
        return sprintf( '<input type="checkbox" name="session_ids[]" value="%s" />', esc_attr( $item['session_id'] ) );
    }

    protected function column_default( $item, $col ) {
        if ( $col === 'urls' ) {
            $sig  = InspectPage_REST::sign_session_id( $item['session_id'] );
            $base = rest_url( INSPECT_PAGE_REST_NS . '/share/' . $item['session_id'] . '.' . $sig );
            $out = [];
            foreach ( [ 'html' => 'index.html', 'css' => 'style.css', 'js' => 'script.js', 'image' => 'preview.png' ] as $label => $slug ) {
                $u = esc_url( $base . '/' . $slug );
                $out[] = sprintf( '<a href="%s" target="_blank" rel="noopener">%s</a>', $u, esc_html( $label ) );
            }
            return implode( ' · ', $out );
        }
        if ( $col === 'expires_at' ) {
            $exp = isset( $item['expires_at'] ) ? (string) $item['expires_at'] : '';
            if ( ! $exp ) return '';
            $ts  = strtotime( $exp . ' UTC' );
            $now = time();
            if ( $ts <= $now ) {
                return esc_html( $exp ) . ' <span style="color:#a04100">(' . esc_html__( 'expired', 'inspect-page' ) . ')</span>';
            }
            $delta = $ts - $now;
            $h = (int) floor( $delta / 3600 );
            $m = (int) floor( ( $delta % 3600 ) / 60 );
            $countdown = sprintf( '%dh %02dm', $h, $m );
            return esc_html( $exp ) . ' <span class="description">(' . esc_html( $countdown ) . ')</span>';
        }
        if ( $col === 'views' ) {
            $v = isset( $item['views'] ) ? (int) $item['views'] : 0;
            $per = isset( $item['views_per_file'] ) ? json_decode( (string) $item['views_per_file'], true ) : null;
            if ( ! is_array( $per ) ) { $per = []; }
            $tip = sprintf(
                'html %d · css %d · js %d · image %d',
                (int) ( $per['html']  ?? 0 ),
                (int) ( $per['css']   ?? 0 ),
                (int) ( $per['js']    ?? 0 ),
                (int) ( $per['image'] ?? 0 )
            );
            return '<span title="' . esc_attr( $tip ) . '">' . esc_html( (string) $v ) . '</span>';
        }
        return isset( $item[ $col ] ) ? esc_html( (string) $item[ $col ] ) : '';
    }

    protected function column_session_id( $item ) {
        $sid = esc_html( $item['session_id'] );
        $revoke_url = wp_nonce_url(
            add_query_arg( [
                'page'       => 'inspect-page-sessions',
                'action'     => 'revoke',
                'session_id' => $item['session_id'],
            ], admin_url( 'tools.php' ) ),
            'inspect_page_revoke_' . $item['session_id']
        );
        $actions = [
            'revoke' => sprintf(
                '<a href="%s" onclick="return confirm(\'Revoke this session?\')">%s</a>',
                esc_url( $revoke_url ), esc_html__( 'Revoke', 'inspect-page' )
            ),
        ];
        return '<code>' . $sid . '</code>' . $this->row_actions( $actions );
    }

    protected function get_bulk_actions() {
        return [ 'revoke' => __( 'Revoke', 'inspect-page' ) ];
    }

    protected function get_sortable_columns() {
        return [
            'views'      => [ 'views', true ],
            'created_at' => [ 'created_at', false ],
            'expires_at' => [ 'expires_at', false ],
        ];
    }

    public function prepare_items() {
        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        $per_page = 25;
        $page     = max( 1, $this->get_pagenum() );
        $offset   = ( $page - 1 ) * $per_page;

        // Whitelist orderby/order to safely interpolate into the SQL.
        $orderby_in = isset( $_GET['orderby'] ) ? sanitize_key( wp_unslash( $_GET['orderby'] ) ) : 'created_at';
        $order_in   = isset( $_GET['order'] )   ? strtoupper( sanitize_key( wp_unslash( $_GET['order'] ) ) ) : 'DESC';
        $allowed    = [ 'views' => 's.views', 'created_at' => 's.created_at', 'expires_at' => 's.expires_at' ];
        $orderby    = $allowed[ $orderby_in ] ?? 's.created_at';
        $order      = ( $order_in === 'ASC' ) ? 'ASC' : 'DESC';

        $where = '';
        $args  = [];
        if ( ! current_user_can( 'manage_options' ) ) {
            $where  = 'WHERE s.user_id = %d';
            $args[] = get_current_user_id();
        }

        $total_sql = "SELECT COUNT(*) FROM {$p}share_sessions s {$where}";
        $total = (int) $wpdb->get_var( $args ? $wpdb->prepare( $total_sql, $args ) : $total_sql );

        $list_sql = "SELECT s.session_id, s.user_id, s.source_url, s.created_at, s.expires_at,
                            s.views, s.views_per_file,
                            k.name AS kind, st.name AS status,
                            u.user_login
                     FROM {$p}share_sessions s
                     JOIN {$p}share_session_kinds k    ON k.id = s.kind_id
                     JOIN {$p}share_session_statuses st ON st.id = s.status_id
                     LEFT JOIN {$wpdb->users} u        ON u.ID = s.user_id
                     {$where}
                     ORDER BY {$orderby} {$order}
                     LIMIT %d OFFSET %d";
        $args2 = array_merge( $args, [ $per_page, $offset ] );
        $rows = $wpdb->get_results( $wpdb->prepare( $list_sql, $args2 ), ARRAY_A );
        foreach ( $rows as &$r ) {
            $r['user'] = $r['user_login'] ? $r['user_login'] : ( '#' . $r['user_id'] );
            unset( $r['user_login'] );
        }

        $this->_column_headers = [ $this->get_columns(), [], $this->get_sortable_columns() ];
        $this->items = $rows;
        $this->set_pagination_args( [
            'total_items' => $total,
            'per_page'    => $per_page,
            'total_pages' => (int) ceil( $total / $per_page ),
        ] );
    }

    public function no_items() {
        esc_html_e( 'No share sessions yet — capture a page from the Inspect Page Chrome extension to create one.', 'inspect-page' );
    }
}

final class InspectPage_Admin {

    public static function init() {
        add_action( 'admin_menu',  [ __CLASS__, 'menu' ] );
        add_action( 'admin_init',  [ __CLASS__, 'handle_actions' ] );
        add_action( 'admin_init',  [ __CLASS__, 'handle_billing_form' ] );
        add_action( 'admin_init',  [ __CLASS__, 'handle_privacy_form' ] );
        add_action( 'admin_init',  [ __CLASS__, 'handle_digest_form' ] );
    }

    public static function menu() {
        add_management_page(
            __( 'Inspect Page Sessions', 'inspect-page' ),
            __( 'Inspect Page Sessions', 'inspect-page' ),
            'upload_files',
            'inspect-page-sessions',
            [ __CLASS__, 'render' ]
        );
        add_management_page(
            __( 'Inspect Page', 'inspect-page' ),
            __( 'Inspect Page', 'inspect-page' ),
            'upload_files',
            'inspect-page',
            [ __CLASS__, 'render_settings' ]
        );
        // Hidden bridge page used by the extension's login popup. After WP
        // logs the user in and redirects here, the page emits a postMessage
        // back to the opener with a fresh wp_rest nonce, then closes.
        add_submenu_page(
            null, // hidden from menu
            __( 'Inspect Page Bridge', 'inspect-page' ),
            __( 'Inspect Page Bridge', 'inspect-page' ),
            'upload_files',
            'inspect-page-bridge',
            [ __CLASS__, 'render_bridge' ]
        );
        // Hidden invite-accept page. Linked from invite emails:
        //   admin.php?page=inspect-page-accept&token=<64-hex>
        // If the user is not signed in, WP will bounce them through wp-login
        // first and back to this page.
        add_submenu_page(
            null,
            __( 'Accept Workspace Invite', 'inspect-page' ),
            __( 'Accept Workspace Invite', 'inspect-page' ),
            'read',
            'inspect-page-accept',
            [ __CLASS__, 'render_accept' ]
        );
        // Workspaces dashboard — top-level entry, visible to anyone who can
        // upload (same gate as the rest of the plugin's admin UI).
        add_management_page(
            __( 'Inspect Page Workspaces', 'inspect-page' ),
            __( 'Inspect Page Workspaces', 'inspect-page' ),
            'upload_files',
            'inspect-page-workspaces',
            [ __CLASS__, 'render_workspaces' ]
        );
    }

    public static function render_accept() {
        if ( ! is_user_logged_in() ) { wp_die( 'Please sign in to accept this invite.' ); }
        $token = isset( $_GET['token'] ) ? sanitize_text_field( wp_unslash( $_GET['token'] ) ) : '';
        if ( $token === '' || ! preg_match( '/^[a-f0-9]{64}$/', $token ) ) {
            echo '<div class="wrap"><h1>Invalid invite</h1><p>The invite link is missing or malformed.</p></div>';
            return;
        }
        $uid    = get_current_user_id();
        $result = InspectPage_Workspaces::accept_invite( $token, $uid );
        echo '<div class="wrap"><h1>' . esc_html__( 'Workspace Invite', 'inspect-page' ) . '</h1>';
        if ( is_wp_error( $result ) ) {
            echo '<div class="notice notice-error"><p>' . esc_html( $result->get_error_message() ) . '</p></div>';
        } else {
            $ws = InspectPage_Workspaces::get( (int) $result['workspace_id'] );
            $name = $ws ? $ws['name'] : '#' . (int) $result['workspace_id'];
            echo '<div class="notice notice-success"><p>' . sprintf(
                /* translators: 1: workspace name, 2: role */
                esc_html__( 'You have joined %1$s as %2$s.', 'inspect-page' ),
                '<strong>' . esc_html( $name ) . '</strong>',
                '<strong>' . esc_html( $result['role'] ) . '</strong>'
            ) . '</p></div>';
            echo '<p><a class="button button-primary" href="' . esc_url( admin_url( 'admin.php?page=inspect-page' ) ) . '">' . esc_html__( 'Go to Inspect Page', 'inspect-page' ) . '</a></p>';
        }
        echo '</div>';
    }

    // ---------------------------------------------------------------------
    // Workspaces admin page (W3)
    // ---------------------------------------------------------------------

    public static function render_workspaces() {
        if ( ! current_user_can( 'upload_files' ) ) { wp_die( 'forbidden' ); }
        $uid     = (int) get_current_user_id();
        $notices = self::handle_workspace_forms( $uid );

        $list = InspectPage_Workspaces::list_for_user( $uid );
        $sel  = isset( $_GET['workspace_id'] ) ? (int) $_GET['workspace_id'] : 0;
        if ( $sel <= 0 && ! empty( $list ) ) { $sel = (int) $list[0]['id']; }
        $role = $sel > 0 ? InspectPage_Workspaces::role_of( $sel, $uid ) : '';
        $ws   = $sel > 0 && $role !== '' ? InspectPage_Workspaces::get( $sel ) : null;

        echo '<div class="wrap"><h1>' . esc_html__( 'Workspaces', 'inspect-page' ) . '</h1>';
        foreach ( $notices as $n ) {
            $cls = $n['ok'] ? 'notice-success' : 'notice-error';
            echo '<div class="notice ' . esc_attr( $cls ) . ' is-dismissible"><p>' . esc_html( $n['msg'] ) . '</p></div>';
        }

        // Switcher
        echo '<h2>' . esc_html__( 'Switch workspace', 'inspect-page' ) . '</h2>';
        if ( empty( $list ) ) {
            echo '<p>' . esc_html__( 'You have no workspaces yet.', 'inspect-page' ) . '</p>';
        } else {
            echo '<form method="get" style="margin-bottom:16px"><input type="hidden" name="page" value="inspect-page-workspaces" />';
            echo '<select name="workspace_id" onchange="this.form.submit()">';
            foreach ( $list as $w ) {
                $sel_attr = (int) $w['id'] === $sel ? ' selected' : '';
                printf(
                    '<option value="%d"%s>%s — %s (%s)</option>',
                    (int) $w['id'], $sel_attr,
                    esc_html( $w['name'] ),
                    esc_html( $w['role'] ),
                    esc_html( $w['license_status'] )
                );
            }
            echo '</select> <button type="submit" class="button">' . esc_html__( 'Open', 'inspect-page' ) . '</button>';
            echo '</form>';
        }

        // Create new workspace
        echo '<h2>' . esc_html__( 'Create workspace', 'inspect-page' ) . '</h2>';
        echo '<form method="post" style="margin-bottom:24px">';
        wp_nonce_field( 'inspect_page_ws_create' );
        echo '<input type="hidden" name="inspect_page_ws_action" value="create" />';
        echo '<input type="text" name="name" maxlength="80" required placeholder="' . esc_attr__( 'Workspace name', 'inspect-page' ) . '" style="min-width:280px" /> ';
        echo '<button class="button button-primary" type="submit">' . esc_html__( 'Create', 'inspect-page' ) . '</button>';
        echo '</form>';

        if ( ! $ws ) { echo '</div>'; return; }

        $is_admin = InspectPage_Workspaces::role_can_admin( $role );
        $is_owner = $role === InspectPage_Workspaces::ROLE_OWNER;

        // Workspace card
        echo '<h2>' . esc_html( $ws['name'] ) . ' <span class="description">— ' . esc_html( $role ) . '</span></h2>';
        echo '<table class="widefat striped" style="max-width:780px;margin-bottom:24px"><tbody>';
        echo '<tr><th style="width:200px">' . esc_html__( 'Workspace ID', 'inspect-page' ) . '</th><td><code>' . (int) $ws['id'] . '</code></td></tr>';
        echo '<tr><th>' . esc_html__( 'License', 'inspect-page' ) . '</th><td><strong>' . esc_html( $ws['license_status'] ) . '</strong></td></tr>';
        echo '<tr><th>' . esc_html__( 'Members', 'inspect-page' ) . '</th><td>' . (int) $ws['member_count'] . '</td></tr>';
        echo '<tr><th>' . esc_html__( 'Created', 'inspect-page' ) . '</th><td>' . esc_html( $ws['created_at'] ) . ' UTC</td></tr>';
        echo '</tbody></table>';

        // Members table
        echo '<h3>' . esc_html__( 'Members', 'inspect-page' ) . '</h3>';
        $members = InspectPage_Workspaces::members( $ws['id'] );
        echo '<table class="widefat striped" style="max-width:780px"><thead><tr>';
        echo '<th>' . esc_html__( 'Name', 'inspect-page' ) . '</th>';
        echo '<th>' . esc_html__( 'Email', 'inspect-page' ) . '</th>';
        echo '<th>' . esc_html__( 'Role', 'inspect-page' ) . '</th>';
        echo '<th>' . esc_html__( 'Joined', 'inspect-page' ) . '</th>';
        if ( $is_admin ) { echo '<th>' . esc_html__( 'Actions', 'inspect-page' ) . '</th>'; }
        echo '</tr></thead><tbody>';
        foreach ( $members as $m ) {
            echo '<tr>';
            echo '<td>' . esc_html( $m['display_name'] ) . '</td>';
            echo '<td>' . esc_html( $m['email'] ) . '</td>';
            echo '<td>' . esc_html( $m['role'] ) . '</td>';
            echo '<td>' . esc_html( $m['joined_at'] ) . '</td>';
            if ( $is_admin ) {
                echo '<td>';
                if ( $m['role'] !== InspectPage_Workspaces::ROLE_OWNER ) {
                    echo '<form method="post" style="display:inline" onsubmit="return confirm(\'Remove this member?\')">';
                    wp_nonce_field( 'inspect_page_ws_remove' );
                    echo '<input type="hidden" name="inspect_page_ws_action" value="remove_member" />';
                    echo '<input type="hidden" name="workspace_id" value="' . (int) $ws['id'] . '" />';
                    echo '<input type="hidden" name="user_id" value="' . (int) $m['user_id'] . '" />';
                    echo '<button class="button button-link-delete" type="submit">' . esc_html__( 'Remove', 'inspect-page' ) . '</button>';
                    echo '</form>';
                }
                if ( $is_owner && $m['role'] !== InspectPage_Workspaces::ROLE_OWNER ) {
                    echo ' <form method="post" style="display:inline" onsubmit="return confirm(\'Transfer ownership to this member? You will be demoted to admin.\')">';
                    wp_nonce_field( 'inspect_page_ws_transfer' );
                    echo '<input type="hidden" name="inspect_page_ws_action" value="transfer" />';
                    echo '<input type="hidden" name="workspace_id" value="' . (int) $ws['id'] . '" />';
                    echo '<input type="hidden" name="user_id" value="' . (int) $m['user_id'] . '" />';
                    echo '<button class="button" type="submit">' . esc_html__( 'Make owner', 'inspect-page' ) . '</button>';
                    echo '</form>';
                }
                echo '</td>';
            }
            echo '</tr>';
        }
        echo '</tbody></table>';

        if ( ! $is_admin ) { echo '</div>'; return; }

        // Invite form
        echo '<h3 style="margin-top:24px">' . esc_html__( 'Invite a member', 'inspect-page' ) . '</h3>';
        echo '<form method="post" style="margin-bottom:16px">';
        wp_nonce_field( 'inspect_page_ws_invite' );
        echo '<input type="hidden" name="inspect_page_ws_action" value="invite" />';
        echo '<input type="hidden" name="workspace_id" value="' . (int) $ws['id'] . '" />';
        echo '<input type="email" name="email" required placeholder="teammate@example.com" style="min-width:260px" /> ';
        echo '<select name="role">';
        echo '<option value="member">' . esc_html__( 'Member', 'inspect-page' ) . '</option>';
        echo '<option value="admin">' . esc_html__( 'Admin', 'inspect-page' ) . '</option>';
        echo '</select> ';
        echo '<button class="button button-primary" type="submit">' . esc_html__( 'Send invite', 'inspect-page' ) . '</button>';
        echo '<p class="description">' . esc_html__( 'Invites expire in 7 days. The recipient must sign in with the invited email address.', 'inspect-page' ) . '</p>';
        echo '</form>';

        // Pending invites
        $pending = InspectPage_Workspaces::list_invites( $ws['id'] );
        echo '<h3>' . esc_html__( 'Pending invites', 'inspect-page' ) . '</h3>';
        if ( empty( $pending ) ) {
            echo '<p class="description">' . esc_html__( 'No pending invites.', 'inspect-page' ) . '</p>';
        } else {
            echo '<table class="widefat striped" style="max-width:780px"><thead><tr>';
            echo '<th>' . esc_html__( 'Email', 'inspect-page' ) . '</th>';
            echo '<th>' . esc_html__( 'Role', 'inspect-page' ) . '</th>';
            echo '<th>' . esc_html__( 'Expires', 'inspect-page' ) . '</th>';
            echo '<th>' . esc_html__( 'Actions', 'inspect-page' ) . '</th>';
            echo '</tr></thead><tbody>';
            foreach ( $pending as $inv ) {
                echo '<tr>';
                echo '<td>' . esc_html( $inv['email'] ) . '</td>';
                echo '<td>' . esc_html( $inv['role'] ) . '</td>';
                echo '<td>' . esc_html( $inv['expires_at'] ) . ' UTC</td>';
                echo '<td><form method="post" style="display:inline" onsubmit="return confirm(\'Revoke this invite?\')">';
                wp_nonce_field( 'inspect_page_ws_revoke' );
                echo '<input type="hidden" name="inspect_page_ws_action" value="revoke" />';
                echo '<input type="hidden" name="workspace_id" value="' . (int) $ws['id'] . '" />';
                echo '<input type="hidden" name="invite_id" value="' . (int) $inv['id'] . '" />';
                echo '<button class="button button-link-delete" type="submit">' . esc_html__( 'Revoke', 'inspect-page' ) . '</button>';
                echo '</form></td>';
                echo '</tr>';
            }
            echo '</tbody></table>';
        }

        echo '</div>';
    }

    /**
     * Handles POST submissions from render_workspaces. Returns an array of
     * notice arrays: [ [ok=>bool, msg=>string], ... ].
     */
    private static function handle_workspace_forms( $uid ) {
        $notices = [];
        if ( $_SERVER['REQUEST_METHOD'] !== 'POST' )                  { return $notices; }
        $action = isset( $_POST['inspect_page_ws_action'] ) ? sanitize_text_field( wp_unslash( $_POST['inspect_page_ws_action'] ) ) : '';
        if ( $action === '' )                                          { return $notices; }

        $ws_id = isset( $_POST['workspace_id'] ) ? (int) $_POST['workspace_id'] : 0;
        $role  = $ws_id > 0 ? InspectPage_Workspaces::role_of( $ws_id, $uid ) : '';

        $ok = function ( $msg ) use ( &$notices ) { $notices[] = [ 'ok' => true,  'msg' => $msg ]; };
        $err = function ( $msg ) use ( &$notices ) { $notices[] = [ 'ok' => false, 'msg' => $msg ]; };

        switch ( $action ) {
            case 'create':
                check_admin_referer( 'inspect_page_ws_create' );
                $name = isset( $_POST['name'] ) ? sanitize_text_field( wp_unslash( $_POST['name'] ) ) : '';
                $res  = InspectPage_Workspaces::create( $uid, $name );
                is_wp_error( $res ) ? $err( $res->get_error_message() ) : $ok( sprintf( 'Workspace "%s" created.', $res['name'] ) );
                break;

            case 'invite':
                check_admin_referer( 'inspect_page_ws_invite' );
                if ( ! InspectPage_Workspaces::role_can_admin( $role ) ) { $err( 'Admin role required.' ); break; }
                $email = isset( $_POST['email'] ) ? sanitize_text_field( wp_unslash( $_POST['email'] ) ) : '';
                $r     = isset( $_POST['role'] )  ? sanitize_text_field( wp_unslash( $_POST['role'] ) )  : 'member';
                $res   = InspectPage_Workspaces::create_invite( $ws_id, $uid, $email, $r );
                is_wp_error( $res ) ? $err( $res->get_error_message() ) : $ok( sprintf( 'Invite sent to %s.', $res['email'] ) );
                break;

            case 'revoke':
                check_admin_referer( 'inspect_page_ws_revoke' );
                if ( ! InspectPage_Workspaces::role_can_admin( $role ) ) { $err( 'Admin role required.' ); break; }
                $iid = isset( $_POST['invite_id'] ) ? (int) $_POST['invite_id'] : 0;
                $res = InspectPage_Workspaces::revoke_invite( $ws_id, $iid );
                $ok( $res['ok'] ? 'Invite revoked.' : 'Invite not found.' );
                break;

            case 'remove_member':
                check_admin_referer( 'inspect_page_ws_remove' );
                if ( ! InspectPage_Workspaces::role_can_admin( $role ) ) { $err( 'Admin role required.' ); break; }
                $tgt = isset( $_POST['user_id'] ) ? (int) $_POST['user_id'] : 0;
                $res = InspectPage_Workspaces::remove_member( $ws_id, $tgt );
                is_wp_error( $res ) ? $err( $res->get_error_message() ) : $ok( 'Member removed.' );
                break;

            case 'transfer':
                check_admin_referer( 'inspect_page_ws_transfer' );
                if ( $role !== InspectPage_Workspaces::ROLE_OWNER ) { $err( 'Only the owner can transfer ownership.' ); break; }
                $tgt = isset( $_POST['user_id'] ) ? (int) $_POST['user_id'] : 0;
                $res = InspectPage_Workspaces::transfer_owner( $ws_id, $tgt );
                is_wp_error( $res ) ? $err( $res->get_error_message() ) : $ok( 'Ownership transferred.' );
                break;
        }
        return $notices;
    }

    public static function render_settings() {
        if ( ! current_user_can( 'upload_files' ) ) { wp_die( 'forbidden' ); }
        if ( ! function_exists( 'is_plugin_active' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        $user = wp_get_current_user();
        $uid  = (int) $user->ID;

        $max_active = (int) get_option( 'inspect_page_max_active_per_user', 30 );
        $max_hour   = (int) get_option( 'inspect_page_max_per_hour_per_user', 30 );
        $ttl_hours  = (int) ( defined( 'INSPECT_PAGE_SHARE_TTL' ) ? INSPECT_PAGE_SHARE_TTL / HOUR_IN_SECONDS : 24 );
        $nextend    = is_plugin_active( 'nextend-facebook-connect/nextend-facebook-connect.php' )
            || class_exists( 'NextendSocialLogin' );

        $active_status_id = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM {$p}share_session_statuses WHERE name = %s",
            InspectPage_SessionStatus::ACTIVE
        ) );
        $active_count = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM {$p}share_sessions WHERE user_id = %d AND status_id = %d AND expires_at > UTC_TIMESTAMP()",
            $uid, $active_status_id
        ) );
        $hour_count = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM {$p}rate_events WHERE user_id = %d AND created_at > (UTC_TIMESTAMP() - INTERVAL 1 HOUR)",
            $uid
        ) );

        $recent = $wpdb->get_results( $wpdb->prepare(
            "SELECT s.session_id, s.created_at, s.expires_at, s.source_url,
                    s.views, s.views_per_file,
                    k.name AS kind, st.name AS status
               FROM {$p}share_sessions s
               JOIN {$p}share_session_kinds k    ON k.id = s.kind_id
               JOIN {$p}share_session_statuses st ON st.id = s.status_id
              WHERE s.user_id = %d
              ORDER BY s.created_at DESC
              LIMIT 10",
            $uid
        ), ARRAY_A );

        $site_url     = untrailingslashit( home_url( '/' ) );
        $bridge_url   = admin_url( 'admin.php?page=inspect-page-bridge' );
        $sessions_url = admin_url( 'tools.php?page=inspect-page-sessions' );
        $rest_health  = esc_url_raw( rest_url( INSPECT_PAGE_REST_NS . '/auth-status' ) );
        $permalinks_ok = (bool) get_option( 'permalink_structure' );

        echo '<div class="wrap"><h1>' . esc_html__( 'Inspect Page', 'inspect-page' ) . '</h1>';
        echo '<p style="max-width:780px">' . esc_html__( 'Inspect Page Smart Share is the WordPress backend for the Inspect Page Chrome extension. It hosts captured HTML / CSS / JS / preview bundles for 24 hours and exposes them via 4 public URLs you can paste into ChatGPT, Claude, Cursor, or Lovable.', 'inspect-page' ) . '</p>';

        if ( ! $permalinks_ok ) {
            echo '<div class="notice notice-error"><p><strong>' . esc_html__( 'Pretty permalinks are disabled.', 'inspect-page' ) . '</strong> ';
            echo esc_html__( 'The REST API needs them. Go to Settings → Permalinks and pick anything other than “Plain”.', 'inspect-page' );
            echo ' <a href="' . esc_url( admin_url( 'options-permalink.php' ) ) . '">' . esc_html__( 'Open Permalinks', 'inspect-page' ) . '</a></p></div>';
        }

        // ── Account ──────────────────────────────────────────────
        echo '<h2>' . esc_html__( 'Your account', 'inspect-page' ) . '</h2>';
        echo '<table class="widefat striped" style="max-width:780px"><tbody>';
        echo '<tr><th style="width:180px">' . esc_html__( 'Signed in as', 'inspect-page' ) . '</th><td><strong>' . esc_html( $user->display_name ) . '</strong> <span class="description">(' . esc_html( $user->user_login ) . ')</span></td></tr>';
        echo '<tr><th>' . esc_html__( 'Email', 'inspect-page' ) . '</th><td>' . esc_html( $user->user_email ) . '</td></tr>';
        echo '<tr><th>' . esc_html__( 'WP user ID', 'inspect-page' ) . '</th><td><code>' . esc_html( (string) $uid ) . '</code></td></tr>';
        echo '<tr><th>' . esc_html__( 'Sign out', 'inspect-page' ) . '</th><td><a class="button" href="' . esc_url( wp_logout_url( admin_url() ) ) . '">' . esc_html__( 'Sign out of WordPress', 'inspect-page' ) . '</a></td></tr>';
        echo '</tbody></table>';

        // ── Pair extension ──────────────────────────────────────
        echo '<h2>' . esc_html__( 'Pair the Chrome extension', 'inspect-page' ) . '</h2>';
        echo '<ol style="max-width:780px">';
        echo '<li>' . esc_html__( 'Install the Inspect Page Chrome extension (inspect-page.zip).', 'inspect-page' ) . '</li>';
        echo '<li>' . sprintf(
            /* translators: %s = site URL */
            esc_html__( 'In the extension Settings → Smart Share, the backend is hard-coded to %s.', 'inspect-page' ),
            '<code>' . esc_html( $site_url ) . '</code>'
        ) . '</li>';
        echo '<li>' . esc_html__( 'Click “Sign in” in the extension. A WordPress login window will open and pair automatically.', 'inspect-page' ) . '</li>';
        echo '</ol>';
        echo '<p><a class="button button-primary" href="' . esc_url( $bridge_url ) . '" target="_blank" rel="noopener">' . esc_html__( 'Test pairing bridge', 'inspect-page' ) . '</a> ';
        echo '<a class="button" href="' . esc_url( $rest_health ) . '" target="_blank" rel="noopener">' . esc_html__( 'Check REST endpoint', 'inspect-page' ) . '</a></p>';

        // ── Quota ───────────────────────────────────────────────
        echo '<h2>' . esc_html__( 'Your usage', 'inspect-page' ) . '</h2>';
        echo '<table class="widefat striped" style="max-width:780px"><thead><tr>';
        echo '<th>' . esc_html__( 'Metric', 'inspect-page' ) . '</th><th>' . esc_html__( 'Current', 'inspect-page' ) . '</th><th>' . esc_html__( 'Limit', 'inspect-page' ) . '</th>';
        echo '</tr></thead><tbody>';
        echo '<tr><td>' . esc_html__( 'Active share sessions', 'inspect-page' ) . '</td><td>' . (int) $active_count . '</td><td>' . (int) $max_active . '</td></tr>';
        echo '<tr><td>' . esc_html__( 'Uploads in the last hour', 'inspect-page' ) . '</td><td>' . (int) $hour_count . '</td><td>' . (int) $max_hour . '</td></tr>';
        echo '<tr><td>' . esc_html__( 'Share lifetime', 'inspect-page' ) . '</td><td>' . (int) $ttl_hours . 'h</td><td>' . (int) $ttl_hours . 'h</td></tr>';
        echo '</tbody></table>';
        echo '<p class="description">' . sprintf(
            esc_html__( 'Limits are stored in wp_options keys %1$s and %2$s.', 'inspect-page' ),
            '<code>inspect_page_max_active_per_user</code>',
            '<code>inspect_page_max_per_hour_per_user</code>'
        ) . '</p>';

        // ── Recent sessions ─────────────────────────────────────
        echo '<h2>' . esc_html__( 'Recent share sessions', 'inspect-page' ) . '</h2>';
        if ( ! $recent ) {
            echo '<p>' . esc_html__( 'No share sessions yet — capture a page from the Inspect Page Chrome extension to create one.', 'inspect-page' ) . '</p>';
        } else {
            echo '<table class="widefat striped"><thead><tr>';
            echo '<th>' . esc_html__( 'Session', 'inspect-page' ) . '</th>';
            echo '<th>' . esc_html__( 'Kind', 'inspect-page' ) . '</th>';
            echo '<th>' . esc_html__( 'Status', 'inspect-page' ) . '</th>';
            echo '<th>' . esc_html__( 'Expires (UTC)', 'inspect-page' ) . '</th>';
            echo '<th>' . esc_html__( 'Views', 'inspect-page' ) . '</th>';
            echo '<th>' . esc_html__( 'Public URLs', 'inspect-page' ) . '</th>';
            echo '</tr></thead><tbody>';
            foreach ( $recent as $r ) {
                $sig  = InspectPage_REST::sign_session_id( $r['session_id'] );
                $base = rest_url( INSPECT_PAGE_REST_NS . '/share/' . $r['session_id'] . '.' . $sig );
                $links = [];
                foreach ( [ 'html' => 'index.html', 'css' => 'style.css', 'js' => 'script.js', 'image' => 'preview.png' ] as $label => $slug ) {
                    $links[] = '<a href="' . esc_url( $base . '/' . $slug ) . '" target="_blank" rel="noopener">' . esc_html( $label ) . '</a>';
                }
                $per = isset( $r['views_per_file'] ) ? json_decode( (string) $r['views_per_file'], true ) : null;
                if ( ! is_array( $per ) ) { $per = []; }
                $tip = sprintf(
                    'html %d · css %d · js %d · image %d',
                    (int) ( $per['html']  ?? 0 ),
                    (int) ( $per['css']   ?? 0 ),
                    (int) ( $per['js']    ?? 0 ),
                    (int) ( $per['image'] ?? 0 )
                );
                echo '<tr>';
                echo '<td><code>' . esc_html( substr( $r['session_id'], 0, 12 ) ) . '…</code></td>';
                echo '<td>' . esc_html( $r['kind'] ) . '</td>';
                echo '<td>' . esc_html( $r['status'] ) . '</td>';
                echo '<td>' . esc_html( $r['expires_at'] ) . '</td>';
                echo '<td><span title="' . esc_attr( $tip ) . '">' . (int) ( $r['views'] ?? 0 ) . '</span></td>';
                echo '<td>' . implode( ' · ', $links ) . '</td>';
                echo '</tr>';
            }
            echo '</tbody></table>';
            echo '<p><a href="' . esc_url( $sessions_url ) . '">' . esc_html__( 'Manage all sessions →', 'inspect-page' ) . '</a></p>';
        }

        // ── Sign-in providers ───────────────────────────────────
        echo '<h2>' . esc_html__( 'Sign-in providers', 'inspect-page' ) . '</h2>';
        echo '<p>' . esc_html__( 'Email + password is built in. Add Google sign-in by installing Nextend Social Login.', 'inspect-page' ) . '</p>';
        if ( $nextend ) {
            echo '<p><strong style="color:#1a7f37;">✓ Nextend Social Login detected.</strong></p>';
        } else {
            echo '<p><strong style="color:#a04100;">Nextend Social Login not detected.</strong> ';
            echo '<a href="' . esc_url( admin_url( 'plugin-install.php?s=nextend+social+login&tab=search&type=term' ) ) . '">' . esc_html__( 'Install it', 'inspect-page' ) . '</a>.</p>';
        }

        // ── Billing (Stripe) ────────────────────────────────────
        self::render_billing_section();

        // ── Privacy / event log ────────────────────────────────
        self::render_privacy_section( $uid );

        // ── Email digest cadence + open rate (D2) ──────────────
        self::render_digest_section( $uid );

        echo '</div>';
    }

    /**
     * Bridge page rendered inside the extension's login popup after WP
     * authenticates the user. Sends a postMessage to window.opener with a
     * fresh wp_rest nonce, then closes.
     */
    public static function render_bridge() {
        if ( ! is_user_logged_in() ) {
            $login = wp_login_url( admin_url( 'admin.php?page=inspect-page-bridge' ) );
            wp_safe_redirect( $login );
            exit;
        }
        $user  = wp_get_current_user();
        $nonce = wp_create_nonce( 'wp_rest' );
        $payload = wp_json_encode( [
            'type'         => 'inspect-page:auth-ok',
            'nonce'        => $nonce,
            'user_id'      => (int) $user->ID,
            'display_name' => $user->display_name,
            'site_url'     => untrailingslashit( home_url( '/' ) ),
        ] );
        ?>
<!doctype html>
<html><head><meta charset="utf-8"><title>Inspect Page paired</title></head>
<body style="font-family:system-ui;padding:24px;text-align:center">
<h1 style="font-size:18px">Inspect Page signed in</h1>
<p>You can close this window.</p>
<script>
(function () {
  var msg = <?php echo $payload; // already JSON-escaped ?>;
  try {
    if (window.opener) {
      window.opener.postMessage(msg, '*');
    }
  } catch (e) {}
  setTimeout(function(){ window.close(); }, 400);
})();
</script>
</body></html>
        <?php
        exit;
    }

    public static function render() {
        if ( ! current_user_can( 'upload_files' ) ) { wp_die( 'forbidden' ); }
        $table = new InspectPage_Sessions_Table();
        $table->prepare_items();
        echo '<div class="wrap"><h1>' . esc_html__( 'Inspect Page Sessions', 'inspect-page' ) . '</h1>';
        if ( ! empty( $_GET['msg'] ) ) {
            $msg = sanitize_text_field( wp_unslash( $_GET['msg'] ) );
            echo '<div class="notice notice-success"><p>' . esc_html( $msg ) . '</p></div>';
        }
        echo '<form method="get"><input type="hidden" name="page" value="inspect-page-sessions" />';
        $table->display();
        echo '</form></div>';
    }

    public static function handle_actions() {
        if ( empty( $_GET['page'] ) || $_GET['page'] !== 'inspect-page-sessions' ) return;
        if ( empty( $_GET['action'] ) || $_GET['action'] !== 'revoke' ) return;
        if ( ! current_user_can( 'upload_files' ) ) { wp_die( 'forbidden' ); }

        $sids = [];
        if ( ! empty( $_GET['session_id'] ) ) {
            check_admin_referer( 'inspect_page_revoke_' . sanitize_text_field( wp_unslash( $_GET['session_id'] ) ) );
            $sids[] = sanitize_text_field( wp_unslash( $_GET['session_id'] ) );
        } elseif ( ! empty( $_REQUEST['session_ids'] ) && is_array( $_REQUEST['session_ids'] ) ) {
            check_admin_referer( 'bulk-sessions' );
            foreach ( $_REQUEST['session_ids'] as $s ) {
                $sids[] = sanitize_text_field( wp_unslash( $s ) );
            }
        }

        $n = 0;
        foreach ( $sids as $sid ) { if ( self::revoke( $sid ) ) $n++; }
        wp_safe_redirect( add_query_arg( [
            'page' => 'inspect-page-sessions',
            'msg'  => sprintf( _n( 'Revoked %d session.', 'Revoked %d sessions.', $n, 'inspect-page' ), $n ),
        ], admin_url( 'tools.php' ) ) );
        exit;
    }

    private static function revoke( $sid ) {
        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        $row = $wpdb->get_row( $wpdb->prepare(
            "SELECT id, user_id FROM {$p}share_sessions WHERE session_id = %s", $sid
        ) );
        if ( ! $row ) return false;
        if ( (int) $row->user_id !== get_current_user_id() && ! current_user_can( 'manage_options' ) ) {
            return false;
        }
        InspectPage_Storage::delete_session_files( $row->user_id, $sid );
        $status_id = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM {$p}share_session_statuses WHERE name = %s",
            InspectPage_SessionStatus::REVOKED
        ) );
        if ( $status_id ) {
            $wpdb->update( "{$p}share_sessions", [ 'status_id' => $status_id ], [ 'id' => $row->id ] );
        }
        return true;
    }

    /**
     * Renders the Billing (Stripe) section on the main settings dashboard.
     * Admins set Stripe credentials here; users see their license status.
     */
    public static function render_billing_section() {
        $is_admin   = current_user_can( 'manage_options' );
        $configured = InspectPage_Billing::is_configured();
        $secret_set   = (bool) get_option( InspectPage_Billing::OPT_SECRET, '' );
        $price        = (string) get_option( InspectPage_Billing::OPT_PRICE, '' );
        $webhook_set  = (bool) get_option( InspectPage_Billing::OPT_WEBHOOK, '' );
        $mode         = (string) get_option( InspectPage_Billing::OPT_MODE, 'sandbox' );
        $webhook_url  = rest_url( INSPECT_PAGE_REST_NS . '/billing/webhook' );

        echo '<h2>' . esc_html__( 'Billing (Stripe)', 'inspect-page' ) . '</h2>';

        if ( ! empty( $_GET['billing'] ) ) {
            $b = sanitize_text_field( wp_unslash( $_GET['billing'] ) );
            if ( $b === 'ok' )      echo '<div class="notice notice-success"><p>' . esc_html__( 'Subscription confirmed. License unlocked.', 'inspect-page' ) . '</p></div>';
            if ( $b === 'cancel' )  echo '<div class="notice notice-warning"><p>' . esc_html__( 'Checkout cancelled — no charge was made.', 'inspect-page' ) . '</p></div>';
            if ( $b === 'saved' )   echo '<div class="notice notice-success"><p>' . esc_html__( 'Stripe credentials saved.', 'inspect-page' ) . '</p></div>';
        }

        if ( $configured ) {
            echo '<p><strong style="color:#1a7f37;">✓ ' . esc_html__( 'Stripe connected', 'inspect-page' ) . '</strong> ';
            echo '<span class="description">(' . esc_html( $mode === 'live' ? 'live mode' : 'test mode' ) . ')</span></p>';
        } else {
            echo '<p><strong style="color:#a04100;">' . esc_html__( 'Stripe not configured.', 'inspect-page' ) . '</strong> ';
            echo esc_html__( 'Paste your Stripe credentials below to enable Pro upgrades.', 'inspect-page' ) . '</p>';
        }

        // Admins-only configuration form.
        if ( $is_admin ) {
            echo '<form method="post" style="max-width:780px;background:#fff;border:1px solid #c3c4c7;padding:16px;margin-bottom:16px">';
            wp_nonce_field( 'inspect_page_billing_save' );
            echo '<input type="hidden" name="inspect_page_billing_form" value="1" />';

            echo '<table class="form-table"><tbody>';

            echo '<tr><th><label for="ip-stripe-mode">' . esc_html__( 'Mode', 'inspect-page' ) . '</label></th><td>';
            echo '<select id="ip-stripe-mode" name="mode">';
            echo '<option value="sandbox"' . selected( $mode, 'sandbox', false ) . '>' . esc_html__( 'Test (sandbox)', 'inspect-page' ) . '</option>';
            echo '<option value="live"'    . selected( $mode, 'live',    false ) . '>' . esc_html__( 'Live',           'inspect-page' ) . '</option>';
            echo '</select>';
            echo '<p class="description">' . esc_html__( 'Pick the mode that matches the keys you\'re pasting below.', 'inspect-page' ) . '</p>';
            echo '</td></tr>';

            echo '<tr><th><label for="ip-stripe-secret">' . esc_html__( 'Secret key', 'inspect-page' ) . '</label></th><td>';
            echo '<input id="ip-stripe-secret" name="secret" type="password" class="regular-text" autocomplete="off" placeholder="' . ( $secret_set ? '••••••••••••••••' : 'sk_test_…' ) . '" />';
            echo '<p class="description">' . wp_kses_post( __( 'Stripe Dashboard → Developers → API keys → <code>sk_test_…</code> or <code>sk_live_…</code>. Stored encrypted-at-rest by your DB; never sent to the browser.', 'inspect-page' ) ) . '</p>';
            if ( $secret_set ) echo '<p><label><input type="checkbox" name="clear_secret" value="1" /> ' . esc_html__( 'Clear stored secret key', 'inspect-page' ) . '</label></p>';
            echo '</td></tr>';

            echo '<tr><th><label for="ip-stripe-price">' . esc_html__( 'Price ID', 'inspect-page' ) . '</label></th><td>';
            echo '<input id="ip-stripe-price" name="price_id" type="text" class="regular-text" value="' . esc_attr( $price ) . '" placeholder="price_…" />';
            echo '<p class="description">' . wp_kses_post( __( 'Stripe Dashboard → Products → create a recurring $5/mo product → copy its <code>price_…</code> ID.', 'inspect-page' ) ) . '</p>';
            echo '</td></tr>';

            echo '<tr><th><label for="ip-stripe-webhook">' . esc_html__( 'Webhook secret', 'inspect-page' ) . '</label></th><td>';
            echo '<input id="ip-stripe-webhook" name="webhook_secret" type="password" class="regular-text" autocomplete="off" placeholder="' . ( $webhook_set ? '••••••••••••••••' : 'whsec_…' ) . '" />';
            echo '<p class="description">';
            echo wp_kses_post( __( 'Stripe Dashboard → Developers → Webhooks → Add endpoint. Endpoint URL: ', 'inspect-page' ) );
            echo '<code>' . esc_html( $webhook_url ) . '</code>. ';
            echo esc_html__( 'Subscribe to: checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted.', 'inspect-page' );
            echo '</p>';
            if ( $webhook_set ) echo '<p><label><input type="checkbox" name="clear_webhook" value="1" /> ' . esc_html__( 'Clear stored webhook secret', 'inspect-page' ) . '</label></p>';
            echo '</td></tr>';

            echo '</tbody></table>';
            submit_button( __( 'Save Stripe credentials', 'inspect-page' ) );
            echo '</form>';
        } else {
            echo '<p class="description">' . esc_html__( 'Only site administrators can configure Stripe credentials.', 'inspect-page' ) . '</p>';
        }

        // Per-user license status + checkout button (visible to everyone).
        $uid         = get_current_user_id();
        $has_license = InspectPage_License::has_license( $uid );
        $has_customer = (bool) get_user_meta( $uid, InspectPage_Billing::META_CUSTOMER, true );

        echo '<h3>' . esc_html__( 'Your subscription', 'inspect-page' ) . '</h3>';
        echo '<table class="widefat striped" style="max-width:780px"><tbody>';
        echo '<tr><th style="width:200px">' . esc_html__( 'Plan', 'inspect-page' ) . '</th><td>';
        echo $has_license
            ? '<strong style="color:#1a7f37;">' . esc_html__( 'Pro — unlimited shares', 'inspect-page' ) . '</strong>'
            : esc_html__( 'Free — 5 lifetime shares', 'inspect-page' );
        echo '</td></tr></tbody></table>';

        if ( $configured && ! $has_license ) {
            $checkout_endpoint = esc_url( admin_url( 'admin-post.php?action=inspect_page_checkout' ) );
            echo '<p style="margin-top:12px"><a class="button button-primary" href="' . $checkout_endpoint . '">' . esc_html__( 'Upgrade to Pro — $5/month', 'inspect-page' ) . '</a></p>';
        } elseif ( $configured && $has_license && $has_customer ) {
            $portal_endpoint = esc_url( admin_url( 'admin-post.php?action=inspect_page_portal' ) );
            echo '<p style="margin-top:12px"><a class="button" href="' . $portal_endpoint . '">' . esc_html__( 'Manage subscription', 'inspect-page' ) . '</a></p>';
        }

        // Marketing-page hint (admins only): show the pricing shortcode.
        if ( current_user_can( 'manage_options' ) ) {
            echo '<h3>' . esc_html__( 'Public pricing page', 'inspect-page' ) . '</h3>';
            echo '<p>' . wp_kses_post( __( 'Drop this shortcode on any page to render a Free vs Pro comparison with a one-click Stripe Checkout button:', 'inspect-page' ) ) . '</p>';
            echo '<p><code style="user-select:all;font-size:13px;background:#f6f7f7;padding:6px 10px;border-radius:4px;">[inspect_page_pricing]</code></p>';
            echo '<p class="description">' . wp_kses_post( __( 'There is also <code>[inspect_page_account]</code> for a logged-in "My Inspect Page" panel (license status, recent shares, revoke buttons).', 'inspect-page' ) ) . '</p>';
        }
    }

    /** Saves Stripe credentials posted from the Billing section. */
    public static function handle_billing_form() {
        if ( empty( $_POST['inspect_page_billing_form'] ) ) return;
        if ( ! current_user_can( 'manage_options' ) ) wp_die( 'forbidden' );
        check_admin_referer( 'inspect_page_billing_save' );

        $mode = isset( $_POST['mode'] ) && $_POST['mode'] === 'live' ? 'live' : 'sandbox';
        update_option( InspectPage_Billing::OPT_MODE, $mode, false );

        if ( ! empty( $_POST['clear_secret'] ) ) {
            delete_option( InspectPage_Billing::OPT_SECRET );
        } elseif ( ! empty( $_POST['secret'] ) ) {
            update_option( InspectPage_Billing::OPT_SECRET, sanitize_text_field( wp_unslash( $_POST['secret'] ) ), false );
        }

        $price_id = isset( $_POST['price_id'] ) ? sanitize_text_field( wp_unslash( $_POST['price_id'] ) ) : '';
        update_option( InspectPage_Billing::OPT_PRICE, $price_id, false );

        if ( ! empty( $_POST['clear_webhook'] ) ) {
            delete_option( InspectPage_Billing::OPT_WEBHOOK );
        } elseif ( ! empty( $_POST['webhook_secret'] ) ) {
            update_option( InspectPage_Billing::OPT_WEBHOOK, sanitize_text_field( wp_unslash( $_POST['webhook_secret'] ) ), false );
        }

        wp_safe_redirect( add_query_arg( [ 'page' => 'inspect-page', 'billing' => 'saved' ], admin_url( 'admin.php' ) ) );
        exit;
    }

    /**
     * admin-post handlers: open Stripe Checkout / Billing Portal from the
     * dashboard. Both reuse InspectPage_Billing internals.
     */
    public static function handle_admin_post_checkout() {
        if ( ! is_user_logged_in() ) wp_die( 'login required' );
        $req = new WP_REST_Request( 'POST', '/' . INSPECT_PAGE_REST_NS . '/billing/checkout' );
        $res = InspectPage_Billing::rest_checkout( $req );
        if ( is_wp_error( $res ) ) wp_die( esc_html( $res->get_error_message() ) );
        wp_redirect( $res['url'] ); exit;
    }
    public static function handle_admin_post_portal() {
        if ( ! is_user_logged_in() ) wp_die( 'login required' );
        $req = new WP_REST_Request( 'POST', '/' . INSPECT_PAGE_REST_NS . '/billing/portal' );
        $res = InspectPage_Billing::rest_portal( $req );
        if ( is_wp_error( $res ) ) wp_die( esc_html( $res->get_error_message() ) );
        wp_redirect( $res['url'] ); exit;
    }

    /**
     * Privacy section — per-user opt-in to the anonymized event log
     * (Pro only). Free users see the toggle disabled with an upgrade hint.
     */
    public static function render_privacy_section( $uid ) {
        $is_pro  = class_exists( 'InspectPage_License' ) && InspectPage_License::has_license( (int) $uid );
        $optin   = get_user_meta( (int) $uid, InspectPage_Stats::OPTIN_META, true );
        $checked = ( $optin === '1' || $optin === 1 || $optin === true );

        echo '<h2>' . esc_html__( 'Privacy — visitor analytics', 'inspect-page' ) . '</h2>';
        echo '<form method="post" style="max-width:780px">';
        wp_nonce_field( 'inspect_page_privacy_save' );
        echo '<input type="hidden" name="inspect_page_privacy_form" value="1" />';
        echo '<p><label>';
        echo '<input type="checkbox" name="event_log_optin" value="1" ' . checked( $checked, true, false );
        if ( ! $is_pro ) echo ' disabled';
        echo ' /> ';
        echo esc_html__( 'Log per-visit anonymized analytics (hashed IP + user-agent) for 30 days.', 'inspect-page' );
        echo '</label></p>';
        echo '<p class="description">';
        echo esc_html__( 'Default OFF. When enabled, each visit to one of your Smart Share URLs is recorded as a one-way HMAC hash so you can see how many distinct visitors viewed your share. Raw IP and user-agent never hit the database. Rolling 30-day window — older rows are deleted automatically.', 'inspect-page' );
        echo '</p>';
        if ( ! $is_pro ) {
            echo '<p><strong>' . esc_html__( 'Upgrade to Pro to enable this.', 'inspect-page' ) . '</strong></p>';
        }
        submit_button( __( 'Save privacy settings', 'inspect-page' ), 'secondary', '', false );
        echo '</form>';

        if ( $is_pro && $checked ) {
            $events = InspectPage_Stats::recent_events_for_user( (int) $uid, 50 );
            echo '<h3>' . esc_html__( 'Recent visitors', 'inspect-page' ) . '</h3>';
            if ( ! $events ) {
                echo '<p>' . esc_html__( 'No visits recorded yet in the last 30 days.', 'inspect-page' ) . '</p>';
            } else {
                echo '<table class="widefat striped" style="max-width:780px"><thead><tr>';
                echo '<th>' . esc_html__( 'When (UTC)', 'inspect-page' ) . '</th>';
                echo '<th>' . esc_html__( 'Session', 'inspect-page' ) . '</th>';
                echo '<th>' . esc_html__( 'Asset', 'inspect-page' ) . '</th>';
                echo '<th>' . esc_html__( 'Visitor (hashed)', 'inspect-page' ) . '</th>';
                echo '<th>' . esc_html__( 'Export', 'inspect-page' ) . '</th>';
                echo '</tr></thead><tbody>';
                $nonce = wp_create_nonce( 'wp_rest' );
                $seen  = [];
                foreach ( $events as $e ) {
                    echo '<tr>';
                    echo '<td>' . esc_html( (string) $e['created_at'] ) . '</td>';
                    echo '<td><code>' . esc_html( substr( (string) $e['session_id'], 0, 12 ) ) . '…</code></td>';
                    echo '<td>' . esc_html( (string) $e['kind'] ) . '</td>';
                    echo '<td><code>' . esc_html( substr( (string) $e['ip_hash'], 0, 12 ) ) . '…</code></td>';
                    $sid = (string) $e['session_id'];
                    if ( isset( $seen[ $sid ] ) ) {
                        echo '<td></td>';
                    } else {
                        $seen[ $sid ] = true;
                        $url = esc_url( add_query_arg( '_wpnonce', $nonce,
                            rest_url( INSPECT_PAGE_REST_NS . '/sessions/' . rawurlencode( $sid ) . '/events.csv' )
                        ) );
                        echo '<td><a class="button button-small" href="' . $url . '">'
                            . esc_html__( 'Download CSV', 'inspect-page' ) . '</a></td>';
                    }
                    echo '</tr>';
                }
                echo '</tbody></table>';
                echo '<p class="description">' . esc_html__( 'CSV includes up to 200 most recent events per session. Hashes are one-way HMAC; raw IP/UA never leave the database.', 'inspect-page' ) . '</p>';
            }
        }
    }

    /** Saves the privacy opt-in toggle. */
    public static function handle_privacy_form() {
        if ( empty( $_POST['inspect_page_privacy_form'] ) ) return;
        if ( ! is_user_logged_in() ) wp_die( 'login required' );
        check_admin_referer( 'inspect_page_privacy_save' );
        $uid = get_current_user_id();
        $val = ! empty( $_POST['event_log_optin'] ) ? '1' : '';
        // Pro gate enforced server-side: free users cannot enable the log.
        if ( $val === '1' && ! ( class_exists( 'InspectPage_License' ) && InspectPage_License::has_license( $uid ) ) ) {
            $val = '';
        }
        update_user_meta( $uid, InspectPage_Stats::OPTIN_META, $val );
        wp_safe_redirect( add_query_arg( [ 'page' => 'inspect-page', 'privacy' => 'saved' ], admin_url( 'admin.php' ) ) );
        exit;
    }

    /**
     * D2 — Email digest cadence + open-rate panel.
     * Free users can only choose Weekly. Pro users can switch to Daily.
     */
    public static function render_digest_section( $uid ) {
        if ( ! class_exists( 'InspectPage_Digest' ) ) return;
        $is_pro   = class_exists( 'InspectPage_License' ) && InspectPage_License::has_license( (int) $uid );
        $cadence  = InspectPage_Digest::cadence_for( (int) $uid );
        $optout   = InspectPage_Digest::user_opted_out( (int) $uid );
        $last_op  = (string) get_user_meta( (int) $uid, InspectPage_Digest::LAST_OPEN_META, true );
        $opens_7  = InspectPage_Digest::opens_last_7d( (int) $uid );
        $last_run = (int) get_option( InspectPage_Digest::RUN_OPTION, 0 );

        echo '<h2>' . esc_html__( 'Email digest', 'inspect-page' ) . '</h2>';
        echo '<form method="post" style="max-width:780px">';
        wp_nonce_field( 'inspect_page_digest_save' );
        echo '<input type="hidden" name="inspect_page_digest_form" value="1" />';

        echo '<p><label><input type="checkbox" name="digest_optout" value="1" '
            . checked( $optout, true, false ) . ' /> '
            . esc_html__( 'Stop sending me the digest.', 'inspect-page' )
            . '</label></p>';

        echo '<p><label>' . esc_html__( 'Cadence', 'inspect-page' ) . ' ';
        echo '<select name="digest_cadence">';
        echo '<option value="weekly"' . selected( $cadence, 'weekly', false ) . '>'
            . esc_html__( 'Weekly (default)', 'inspect-page' ) . '</option>';
        echo '<option value="daily"' . selected( $cadence, 'daily', false );
        if ( ! $is_pro ) echo ' disabled';
        echo '>' . esc_html__( 'Daily — Pro only', 'inspect-page' ) . '</option>';
        echo '</select></label></p>';
        if ( ! $is_pro ) {
            echo '<p class="description">' . esc_html__( 'Upgrade to Pro to switch to a daily cadence.', 'inspect-page' ) . '</p>';
        }
        submit_button( __( 'Save digest settings', 'inspect-page' ), 'secondary', '', false );
        echo '</form>';

        echo '<table class="widefat striped" style="max-width:780px;margin-top:16px"><tbody>';
        echo '<tr><th>' . esc_html__( 'Last cron run (UTC)', 'inspect-page' ) . '</th><td>'
            . esc_html( $last_run ? gmdate( 'Y-m-d H:i:s', $last_run ) : '—' ) . '</td></tr>';
        echo '<tr><th>' . esc_html__( 'Last open (UTC)', 'inspect-page' ) . '</th><td>'
            . esc_html( $last_op ?: '—' ) . '</td></tr>';
        echo '<tr><th>' . esc_html__( 'Opens (last 7 days)', 'inspect-page' ) . '</th><td>'
            . (int) $opens_7 . '</td></tr>';
        echo '</tbody></table>';
        echo '<p class="description">' . esc_html__( 'Opens are counted via a 1×1 transparent pixel embedded in the digest email. Some clients block remote images, so this is a lower bound.', 'inspect-page' ) . '</p>';
    }

    /** Saves digest cadence + opt-out. Pro gate enforced server-side. */
    public static function handle_digest_form() {
        if ( empty( $_POST['inspect_page_digest_form'] ) ) return;
        if ( ! is_user_logged_in() ) wp_die( 'login required' );
        check_admin_referer( 'inspect_page_digest_save' );
        if ( ! class_exists( 'InspectPage_Digest' ) ) return;
        $uid = get_current_user_id();
        InspectPage_Digest::set_optout( $uid, ! empty( $_POST['digest_optout'] ) );
        $cad = isset( $_POST['digest_cadence'] ) ? (string) $_POST['digest_cadence'] : 'weekly';
        InspectPage_Digest::set_cadence( $uid, $cad );
        wp_safe_redirect( add_query_arg( [ 'page' => 'inspect-page', 'digest' => 'saved' ], admin_url( 'admin.php' ) ) );
        exit;
    }
}

InspectPage_Admin::init();
add_action( 'admin_post_inspect_page_checkout', [ 'InspectPage_Admin', 'handle_admin_post_checkout' ] );
add_action( 'admin_post_inspect_page_portal',   [ 'InspectPage_Admin', 'handle_admin_post_portal' ] );