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
        add_shortcode( 'inspect_page_pricing', [ __CLASS__, 'render_pricing' ] );
        add_action( 'init', [ __CLASS__, 'maybe_handle_revoke' ] );
    }

    /**
     * `[inspect_page_pricing]` — Free vs Pro comparison + Stripe Checkout CTA.
     *
     * Logged-in users get a one-click "Upgrade to Pro" button that POSTs to
     * the WP REST `/billing/checkout` endpoint via fetch (cookie + nonce) and
     * redirects to the Stripe-hosted Checkout URL. Pro users see "Manage
     * subscription" → Customer Portal. Logged-out visitors see a Log in link.
     */
    public static function render_pricing() {
        $configured = class_exists( 'InspectPage_Billing' ) && InspectPage_Billing::is_configured();
        $free_limit = (int) get_option( 'inspect_page_free_lifetime_limit', 5 );
        $is_logged_in = is_user_logged_in();
        $is_pro       = false;
        $used         = 0;
        if ( $is_logged_in ) {
            $uid     = get_current_user_id();
            $summary = InspectPage_License::summary( $uid );
            $is_pro  = ! empty( $summary['has_license'] );
            $used    = (int) ( $summary['lifetime_used'] ?? 0 );
        }
        $just_upgraded = ! empty( $_GET['inspect_page_upgraded'] );
        ob_start();
        ?>
        <style>
        .ip-pricing { max-width: 880px; margin: 24px 0; font-family: inherit; }
        .ip-pricing-banner { padding: 10px 14px; border-radius: 8px; margin-bottom: 16px;
            background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; font-size: 14px; }
        .ip-pricing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 640px) { .ip-pricing-grid { grid-template-columns: 1fr; } }
        .ip-pricing-card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px;
            background: #fff; position: relative; display: flex; flex-direction: column; }
        .ip-pricing-card.is-featured { border: 2px solid #2563eb; box-shadow: 0 6px 20px -8px rgba(37,99,235,0.35); }
        .ip-pricing-card.is-current  { border-color: #16a34a; }
        .ip-pricing-tag { position: absolute; top: -10px; right: 14px;
            font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px;
            background: #2563eb; color: #fff; letter-spacing: 0.02em; }
        .ip-pricing-tag.is-current { background: #16a34a; }
        .ip-pricing-name { margin: 0 0 4px 0; font-size: 18px; }
        .ip-pricing-price { font-size: 32px; font-weight: 700; margin: 4px 0 16px; line-height: 1; }
        .ip-pricing-price small { font-size: 14px; color: #6b7280; font-weight: 400; margin-left: 4px; }
        .ip-pricing-feats { list-style: none; padding: 0; margin: 0 0 16px; }
        .ip-pricing-feats li { padding: 4px 0 4px 22px; position: relative; line-height: 1.5; font-size: 14px; }
        .ip-pricing-feats li::before { content: "✓"; position: absolute; left: 0; top: 4px;
            color: #16a34a; font-weight: 700; }
        .ip-pricing-feats li.is-strong { font-weight: 600; }
        .ip-pricing-cta { margin-top: auto; }
        .ip-pricing-status { color: #6b7280; font-size: 13px; margin-left: 8px; }
        .ip-pricing-note { color: #6b7280; font-size: 12px; margin-top: 10px; }
        </style>
        <div class="ip-pricing inspect-page-pricing">
            <?php if ( $just_upgraded && $is_pro ) : ?>
                <div class="ip-pricing-banner" role="status">
                    <?php esc_html_e( "You're on Pro — thanks for supporting Inspect Page!", 'inspect-page' ); ?>
                </div>
            <?php endif; ?>
            <div class="ip-pricing-grid">
                <div class="ip-pricing-card<?php echo ( $is_logged_in && ! $is_pro ) ? ' is-current' : ''; ?>">
                    <?php if ( $is_logged_in && ! $is_pro ) : ?>
                        <span class="ip-pricing-tag is-current"><?php esc_html_e( 'Current plan', 'inspect-page' ); ?></span>
                    <?php endif; ?>
                    <h3 class="ip-pricing-name"><?php esc_html_e( 'Free', 'inspect-page' ); ?></h3>
                    <p class="ip-pricing-price">$0<small><?php esc_html_e( 'forever', 'inspect-page' ); ?></small></p>
                    <ul class="ip-pricing-feats">
                        <li><?php echo esc_html( sprintf( _n( '%d lifetime Smart Share', '%d lifetime Smart Shares', $free_limit, 'inspect-page' ), $free_limit ) ); ?></li>
                        <li><?php esc_html_e( '24-hour share-link expiry', 'inspect-page' ); ?></li>
                        <li><?php esc_html_e( 'All export modes — MD, MD + files, ZIP, Smart Share', 'inspect-page' ); ?></li>
                        <li><?php esc_html_e( 'Pick Element with full DOM/CSS inspector', 'inspect-page' ); ?></li>
                        <li><?php esc_html_e( 'Box-model overlay, distance guides (Alt), keyboard nav', 'inspect-page' ); ?></li>
                    </ul>
                    <?php if ( $is_logged_in && ! $is_pro ) : ?>
                        <p class="ip-pricing-note">
                            <?php echo esc_html( sprintf(
                                /* translators: 1: used, 2: limit */
                                __( 'You have used %1$d of %2$d free Smart Shares.', 'inspect-page' ),
                                $used, $free_limit
                            ) ); ?>
                        </p>
                    <?php endif; ?>
                </div>
                <div class="ip-pricing-card is-featured<?php echo $is_pro ? ' is-current' : ''; ?>">
                    <?php if ( $is_pro ) : ?>
                        <span class="ip-pricing-tag is-current"><?php esc_html_e( 'Current plan', 'inspect-page' ); ?></span>
                    <?php else : ?>
                        <span class="ip-pricing-tag"><?php esc_html_e( 'Recommended', 'inspect-page' ); ?></span>
                    <?php endif; ?>
                    <h3 class="ip-pricing-name"><?php esc_html_e( 'Pro', 'inspect-page' ); ?></h3>
                    <p class="ip-pricing-price">$5<small><?php esc_html_e( '/ month', 'inspect-page' ); ?></small></p>
                    <ul class="ip-pricing-feats">
                        <li class="is-strong"><?php esc_html_e( 'Unlimited Smart Shares', 'inspect-page' ); ?></li>
                        <li><?php esc_html_e( 'Everything in Free', 'inspect-page' ); ?></li>
                        <li><?php esc_html_e( 'Priority Smart Share queueing', 'inspect-page' ); ?></li>
                        <li><?php esc_html_e( 'Cancel anytime via Stripe Customer Portal', 'inspect-page' ); ?></li>
                    </ul>
                    <div class="ip-pricing-cta">
                        <?php self::render_pricing_cta( $configured ); ?>
                    </div>
                </div>
            </div>
        </div>
        <?php
        return (string) ob_get_clean();
    }

    private static function render_pricing_cta( $configured ) {
        if ( ! is_user_logged_in() ) {
            $login = wp_login_url( ( is_ssl() ? 'https://' : 'http://' )
                . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'] );
            echo '<p><a class="button button-primary" href="' . esc_url( $login ) . '">'
                . esc_html__( 'Log in to upgrade', 'inspect-page' ) . '</a></p>';
            return;
        }
        if ( ! $configured ) {
            echo '<p style="color:#a04100;">' . esc_html__( 'Stripe is not configured on this site yet.', 'inspect-page' ) . '</p>';
            return;
        }
        $uid     = get_current_user_id();
        $is_pro  = InspectPage_License::has_license( $uid );
        $nonce   = wp_create_nonce( 'wp_rest' );
        $checkout = esc_url_raw( rest_url( INSPECT_PAGE_REST_NS . '/billing/checkout' ) );
        $portal   = esc_url_raw( rest_url( INSPECT_PAGE_REST_NS . '/billing/portal' ) );
        $label   = $is_pro
            ? __( 'Manage subscription', 'inspect-page' )
            : __( 'Upgrade to Pro', 'inspect-page' );
        $endpoint = $is_pro ? $portal : $checkout;
        ?>
        <button class="button button-primary inspect-page-billing-cta"
                data-endpoint="<?php echo esc_attr( $endpoint ); ?>"
                data-nonce="<?php echo esc_attr( $nonce ); ?>"
                style="margin-top:12px;">
            <?php echo esc_html( $label ); ?>
        </button>
        <span class="inspect-page-billing-status" style="margin-left:8px;color:#6b7280;font-size:13px;"></span>
        <script>
        (function(){
          var btns = document.querySelectorAll('.inspect-page-billing-cta');
          btns.forEach(function(btn){
            if (btn.dataset.bound === '1') return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function(){
              var status = btn.parentNode.querySelector('.inspect-page-billing-status');
              btn.disabled = true;
              if (status) status.textContent = 'Opening Stripe…';
              fetch(btn.dataset.endpoint, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-WP-Nonce': btn.dataset.nonce },
                body: JSON.stringify({ success_url: window.location.href, cancel_url: window.location.href, return_url: window.location.href })
              }).then(function(r){ return r.json().then(function(j){ return { ok: r.ok, j: j }; }); })
              .then(function(o){
                if (o.ok && o.j && o.j.url) { window.location.href = o.j.url; return; }
                if (status) status.textContent = (o.j && o.j.message) ? o.j.message : 'Could not open Stripe';
                btn.disabled = false;
              })
              .catch(function(e){
                if (status) status.textContent = String(e && e.message || e);
                btn.disabled = false;
              });
            });
          });
        })();
        </script>
        <?php
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