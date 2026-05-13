<?php
/**
 * Front-end "My Inspect Page" shortcode (v2.3 dashboard).
 *
 *   [inspect_page_account]
 *
 * Renders an account panel for the logged-in WP user containing:
 *   - Display name + email
 *   - License status + lifetime quota
 *   - Last 20 Smart Share sessions with revoke buttons
 *
 * Logged-out visitors see a "Log in to manage your shares" notice with a
 * link to wp-login.php (return = current URL).
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class InspectPage_Shortcode {

    public static function register() {
        add_shortcode( 'inspect_page_account', [ __CLASS__, 'render' ] );
        add_action( 'init', [ __CLASS__, 'maybe_handle_revoke' ] );
    }

    public static function render() {
        if ( ! is_user_logged_in() ) {
            $login = wp_login_url( ( is_ssl() ? 'https://' : 'http://' )
                . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'] );
            return '<div class="inspect-page-account inspect-page-loggedout">'
                . '<p>' . esc_html__( 'Log in to manage your Inspect Page shares.', 'inspect-page' ) . '</p>'
                . '<p><a class="button" href="' . esc_url( $login ) . '">'
                . esc_html__( 'Log in', 'inspect-page' ) . '</a></p></div>';
        }

        $user_id = get_current_user_id();
        $user    = wp_get_current_user();
        $summary = InspectPage_License::summary( $user_id );

        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        $rows = $wpdb->get_results( $wpdb->prepare(
            "SELECT s.session_id, k.name AS kind, st.name AS status, s.source_url,
                    s.created_at, s.expires_at
             FROM {$p}share_sessions s
             JOIN {$p}share_session_kinds k    ON k.id  = s.kind_id
             JOIN {$p}share_session_statuses st ON st.id = s.status_id
             WHERE s.user_id = %d
             ORDER BY s.created_at DESC
             LIMIT 20", $user_id
        ), ARRAY_A );

        ob_start(); ?>
        <div class="inspect-page-account">
          <h3><?php esc_html_e( 'Account', 'inspect-page' ); ?></h3>
          <p>
            <strong><?php echo esc_html( $user->display_name ); ?></strong><br>
            <?php echo esc_html( $user->user_email ); ?>
          </p>
          <h3><?php esc_html_e( 'Plan', 'inspect-page' ); ?></h3>
          <?php if ( $summary['has_license'] ) : ?>
            <p><strong><?php esc_html_e( 'Pro — unlimited shares', 'inspect-page' ); ?></strong></p>
          <?php else : ?>
            <p>
              <?php
              echo esc_html( sprintf(
                /* translators: 1: used count, 2: limit */
                __( 'Free plan — %1$d / %2$d lifetime shares used.', 'inspect-page' ),
                $summary['lifetime_used'], $summary['free_limit']
              ) ); ?>
            </p>
          <?php endif; ?>

          <h3><?php esc_html_e( 'Recent shares', 'inspect-page' ); ?></h3>
          <?php if ( empty( $rows ) ) : ?>
            <p><em><?php esc_html_e( 'No shares yet.', 'inspect-page' ); ?></em></p>
          <?php else : ?>
            <table class="inspect-page-sessions widefat striped">
              <thead>
                <tr>
                  <th><?php esc_html_e( 'Source', 'inspect-page' ); ?></th>
                  <th><?php esc_html_e( 'Kind', 'inspect-page' ); ?></th>
                  <th><?php esc_html_e( 'Status', 'inspect-page' ); ?></th>
                  <th><?php esc_html_e( 'Expires', 'inspect-page' ); ?></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <?php foreach ( $rows as $r ) :
                  $expired = strtotime( $r['expires_at'] ) <= time();
                  $active  = strtolower( $r['status'] ) === 'active' && ! $expired;
                  $host    = wp_parse_url( $r['source_url'], PHP_URL_HOST ) ?: $r['source_url'];
                ?>
                <tr>
                  <td title="<?php echo esc_attr( $r['source_url'] ); ?>">
                    <?php echo esc_html( $host ); ?>
                  </td>
                  <td><?php echo esc_html( $r['kind'] ); ?></td>
                  <td><?php echo esc_html( $expired ? __( 'Expired', 'inspect-page' ) : $r['status'] ); ?></td>
                  <td><?php echo esc_html( get_date_from_gmt( $r['expires_at'], 'Y-m-d H:i' ) ); ?></td>
                  <td>
                    <?php if ( $active ) :
                      $action = wp_nonce_url(
                        add_query_arg( [
                          'inspect_page_revoke' => $r['session_id'],
                        ] ),
                        'inspect_page_revoke_' . $r['session_id']
                      ); ?>
                      <a class="button button-small" href="<?php echo esc_url( $action ); ?>">
                        <?php esc_html_e( 'Revoke', 'inspect-page' ); ?>
                      </a>
                    <?php endif; ?>
                  </td>
                </tr>
                <?php endforeach; ?>
              </tbody>
            </table>
          <?php endif; ?>
        </div>
        <?php
        return (string) ob_get_clean();
    }

    /** Handles `?inspect_page_revoke=<sid>&_wpnonce=...` on any front-end page. */
    public static function maybe_handle_revoke() {
        if ( empty( $_GET['inspect_page_revoke'] ) ) return;
        if ( ! is_user_logged_in() ) return;
        $sid   = sanitize_text_field( wp_unslash( $_GET['inspect_page_revoke'] ) );
        $nonce = isset( $_GET['_wpnonce'] ) ? sanitize_text_field( wp_unslash( $_GET['_wpnonce'] ) ) : '';
        if ( ! wp_verify_nonce( $nonce, 'inspect_page_revoke_' . $sid ) ) return;

        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        $row = $wpdb->get_row( $wpdb->prepare(
            "SELECT id, user_id FROM {$p}share_sessions WHERE session_id = %s", $sid
        ) );
        if ( ! $row ) return;
        if ( (int) $row->user_id !== get_current_user_id() && ! current_user_can( 'manage_options' ) ) return;

        InspectPage_Storage::delete_session_files( $row->user_id, $sid );
        $status_id = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM {$p}share_session_statuses WHERE name = %s",
            InspectPage_SessionStatus::REVOKED
        ) );
        if ( $status_id ) {
            $wpdb->update( "{$p}share_sessions",
                [ 'status_id' => $status_id ], [ 'id' => $row->id ] );
        }
        wp_safe_redirect( remove_query_arg( [ 'inspect_page_revoke', '_wpnonce' ] ) );
        exit;
    }
}