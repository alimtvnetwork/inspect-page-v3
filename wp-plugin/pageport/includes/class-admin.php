<?php
/**
 * wp-admin → Tools → PagePort Sessions screen.
 * Lists current user's sessions (admins see everyone) and exposes a revoke action.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

if ( ! class_exists( 'WP_List_Table' ) ) {
    require_once ABSPATH . 'wp-admin/includes/class-wp-list-table.php';
}

final class PagePort_Sessions_Table extends WP_List_Table {

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
            'session_id' => __( 'Session', 'pageport' ),
            'user'       => __( 'User', 'pageport' ),
            'kind'       => __( 'Kind', 'pageport' ),
            'status'     => __( 'Status', 'pageport' ),
            'source_url' => __( 'Source URL', 'pageport' ),
            'created_at' => __( 'Created (UTC)', 'pageport' ),
            'expires_at' => __( 'Expires (UTC)', 'pageport' ),
            'urls'       => __( 'Public URLs', 'pageport' ),
        ];
    }

    protected function column_cb( $item ) {
        return sprintf( '<input type="checkbox" name="session_ids[]" value="%s" />', esc_attr( $item['session_id'] ) );
    }

    protected function column_default( $item, $col ) {
        if ( $col === 'urls' ) {
            $base = rest_url( PAGEPORT_REST_NS . '/share/' . $item['session_id'] );
            $out = [];
            foreach ( [ 'html', 'css', 'image' ] as $k ) {
                $u = esc_url( $base . '/' . $k );
                $out[] = sprintf( '<a href="%s" target="_blank" rel="noopener">%s</a>', $u, esc_html( $k ) );
            }
            return implode( ' · ', $out );
        }
        return isset( $item[ $col ] ) ? esc_html( (string) $item[ $col ] ) : '';
    }

    protected function column_session_id( $item ) {
        $sid = esc_html( $item['session_id'] );
        $revoke_url = wp_nonce_url(
            add_query_arg( [
                'page'       => 'pageport-sessions',
                'action'     => 'revoke',
                'session_id' => $item['session_id'],
            ], admin_url( 'tools.php' ) ),
            'pageport_revoke_' . $item['session_id']
        );
        $actions = [
            'revoke' => sprintf(
                '<a href="%s" onclick="return confirm(\'Revoke this session?\')">%s</a>',
                esc_url( $revoke_url ), esc_html__( 'Revoke', 'pageport' )
            ),
        ];
        return '<code>' . $sid . '</code>' . $this->row_actions( $actions );
    }

    protected function get_bulk_actions() {
        return [ 'revoke' => __( 'Revoke', 'pageport' ) ];
    }

    public function prepare_items() {
        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        $per_page = 25;
        $page     = max( 1, $this->get_pagenum() );
        $offset   = ( $page - 1 ) * $per_page;

        $where = '';
        $args  = [];
        if ( ! current_user_can( 'manage_options' ) ) {
            $where  = 'WHERE s.user_id = %d';
            $args[] = get_current_user_id();
        }

        $total_sql = "SELECT COUNT(*) FROM {$p}share_sessions s {$where}";
        $total = (int) $wpdb->get_var( $args ? $wpdb->prepare( $total_sql, $args ) : $total_sql );

        $list_sql = "SELECT s.session_id, s.user_id, s.source_url, s.created_at, s.expires_at,
                            k.name AS kind, st.name AS status,
                            u.user_login
                     FROM {$p}share_sessions s
                     JOIN {$p}share_session_kinds k    ON k.id = s.kind_id
                     JOIN {$p}share_session_statuses st ON st.id = s.status_id
                     LEFT JOIN {$wpdb->users} u        ON u.ID = s.user_id
                     {$where}
                     ORDER BY s.created_at DESC
                     LIMIT %d OFFSET %d";
        $args2 = array_merge( $args, [ $per_page, $offset ] );
        $rows = $wpdb->get_results( $wpdb->prepare( $list_sql, $args2 ), ARRAY_A );
        foreach ( $rows as &$r ) {
            $r['user'] = $r['user_login'] ? $r['user_login'] : ( '#' . $r['user_id'] );
            unset( $r['user_login'] );
        }

        $this->_column_headers = [ $this->get_columns(), [], [] ];
        $this->items = $rows;
        $this->set_pagination_args( [
            'total_items' => $total,
            'per_page'    => $per_page,
            'total_pages' => (int) ceil( $total / $per_page ),
        ] );
    }
}

final class PagePort_Admin {

    public static function init() {
        add_action( 'admin_menu',  [ __CLASS__, 'menu' ] );
        add_action( 'admin_init',  [ __CLASS__, 'handle_actions' ] );
    }

    public static function menu() {
        add_management_page(
            __( 'PagePort Sessions', 'pageport' ),
            __( 'PagePort Sessions', 'pageport' ),
            'upload_files',
            'pageport-sessions',
            [ __CLASS__, 'render' ]
        );
        add_management_page(
            __( 'PagePort', 'pageport' ),
            __( 'PagePort', 'pageport' ),
            'upload_files',
            'pageport',
            [ __CLASS__, 'render_pairing' ]
        );
    }

    public static function render_pairing() {
        if ( ! current_user_can( 'upload_files' ) ) { wp_die( 'forbidden' ); }
        echo '<div class="wrap"><h1>' . esc_html__( 'PagePort', 'pageport' ) . '</h1>';
        echo '<p>' . esc_html__( 'Pair a new device with the PagePort extension. (Pairing UI lands in the next stage.)', 'pageport' ) . '</p>';
        echo '</div>';
    }

    public static function render() {
        if ( ! current_user_can( 'upload_files' ) ) { wp_die( 'forbidden' ); }
        $table = new PagePort_Sessions_Table();
        $table->prepare_items();
        echo '<div class="wrap"><h1>' . esc_html__( 'PagePort Sessions', 'pageport' ) . '</h1>';
        if ( ! empty( $_GET['msg'] ) ) {
            $msg = sanitize_text_field( wp_unslash( $_GET['msg'] ) );
            echo '<div class="notice notice-success"><p>' . esc_html( $msg ) . '</p></div>';
        }
        echo '<form method="get"><input type="hidden" name="page" value="pageport-sessions" />';
        $table->display();
        echo '</form></div>';
    }

    public static function handle_actions() {
        if ( empty( $_GET['page'] ) || $_GET['page'] !== 'pageport-sessions' ) return;
        if ( empty( $_GET['action'] ) || $_GET['action'] !== 'revoke' ) return;
        if ( ! current_user_can( 'upload_files' ) ) { wp_die( 'forbidden' ); }

        $sids = [];
        if ( ! empty( $_GET['session_id'] ) ) {
            check_admin_referer( 'pageport_revoke_' . sanitize_text_field( wp_unslash( $_GET['session_id'] ) ) );
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
            'page' => 'pageport-sessions',
            'msg'  => sprintf( _n( 'Revoked %d session.', 'Revoked %d sessions.', $n, 'pageport' ), $n ),
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
        PagePort_Storage::delete_session_files( $row->user_id, $sid );
        $status_id = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM {$p}share_session_statuses WHERE name = %s",
            PagePort_SessionStatus::REVOKED
        ) );
        if ( $status_id ) {
            $wpdb->update( "{$p}share_sessions", [ 'status_id' => $status_id ], [ 'id' => $row->id ] );
        }
        return true;
    }
}

PagePort_Admin::init();