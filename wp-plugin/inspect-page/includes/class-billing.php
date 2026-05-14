<?php
/**
 * Stripe Checkout integration for Inspect Page Pro ($5/mo unlimited).
 *
 * Architecture (option 4a from .lovable/plan.md):
 *   - Site admin pastes their Stripe SECRET key, PRICE id, and WEBHOOK secret
 *     into Settings -> Inspect Page -> Billing.
 *   - Extension (or any WP-logged-in client) POSTs to /billing/checkout to
 *     create a Stripe Checkout session and gets back a hosted-checkout URL.
 *   - Stripe -> POSTs to /billing/webhook on success / cancellation. We verify
 *     the signature and flip user_meta `inspect_page_license` accordingly.
 *
 * Why direct Stripe (not Lovable Cloud / managed payments):
 *   The license lives in WordPress user_meta. Webhooks must hit the WP REST
 *   API to update that meta atomically.
 *
 * Security:
 *   - SECRET key + WEBHOOK secret stored as wp_options, never sent to client.
 *   - /billing/checkout requires logged-in WP user + nonce (same as share routes).
 *   - /billing/webhook is public but signature-verified using Stripe's
 *     v1=HMAC-SHA256 scheme (manual implementation -- no Stripe SDK required).
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class InspectPage_Billing {

    const OPT_SECRET    = 'inspect_page_stripe_secret';
    const OPT_PRICE     = 'inspect_page_stripe_price_id';
    const OPT_WEBHOOK   = 'inspect_page_stripe_webhook_secret';
    const OPT_MODE      = 'inspect_page_stripe_mode'; // 'sandbox' | 'live'
    const META_CUSTOMER = 'inspect_page_stripe_customer';
    const META_SUB      = 'inspect_page_stripe_subscription';

    public static function register_routes() {
        register_rest_route( INSPECT_PAGE_REST_NS, '/billing/checkout', [
            'methods'             => 'POST',
            'callback'            => [ __CLASS__, 'rest_checkout' ],
            'permission_callback' => [ 'InspectPage_Auth', 'require_wp_user' ],
        ] );
        register_rest_route( INSPECT_PAGE_REST_NS, '/billing/portal', [
            'methods'             => 'POST',
            'callback'            => [ __CLASS__, 'rest_portal' ],
            'permission_callback' => [ 'InspectPage_Auth', 'require_wp_user' ],
        ] );
        register_rest_route( INSPECT_PAGE_REST_NS, '/billing/webhook', [
            'methods'             => 'POST',
            'callback'            => [ __CLASS__, 'rest_webhook' ],
            'permission_callback' => '__return_true',
        ] );
        register_rest_route( INSPECT_PAGE_REST_NS, '/billing/status', [
            'methods'             => 'GET',
            'callback'            => [ __CLASS__, 'rest_status' ],
            'permission_callback' => [ 'InspectPage_Auth', 'require_wp_user' ],
        ] );
    }

    public static function is_configured() {
        return (bool) self::secret() && (bool) self::price() && (bool) self::webhook_secret();
    }

    private static function secret()         { return (string) get_option( self::OPT_SECRET, '' ); }
    private static function price()          { return (string) get_option( self::OPT_PRICE, '' ); }
    private static function webhook_secret() { return (string) get_option( self::OPT_WEBHOOK, '' ); }

    public static function rest_checkout( WP_REST_Request $req ) {
        if ( ! self::is_configured() ) {
            return new WP_Error( 'E_BILLING_NOT_CONFIGURED', 'Billing is not configured on this site.', [ 'status' => 503 ] );
        }
        $user = wp_get_current_user();
        $success_url = esc_url_raw( $req->get_param( 'success_url' ) ?: admin_url( 'admin.php?page=inspect-page&billing=ok' ) );
        $cancel_url  = esc_url_raw( $req->get_param( 'cancel_url' )  ?: admin_url( 'admin.php?page=inspect-page&billing=cancel' ) );

        $body = [
            'mode'                                    => 'subscription',
            'line_items[0][price]'                    => self::price(),
            'line_items[0][quantity]'                 => 1,
            'success_url'                             => $success_url,
            'cancel_url'                              => $cancel_url,
            'customer_email'                          => $user->user_email,
            'client_reference_id'                     => (string) $user->ID,
            'metadata[wp_user_id]'                    => (string) $user->ID,
            'subscription_data[metadata][wp_user_id]' => (string) $user->ID,
            'allow_promotion_codes'                   => 'true',
        ];
        $existing_customer = get_user_meta( $user->ID, self::META_CUSTOMER, true );
        if ( $existing_customer ) {
            unset( $body['customer_email'] );
            $body['customer'] = $existing_customer;
        }

        $res = wp_remote_post( 'https://api.stripe.com/v1/checkout/sessions', [
            'headers' => [
                'Authorization' => 'Bearer ' . self::secret(),
                'Content-Type'  => 'application/x-www-form-urlencoded',
            ],
            'body'    => $body,
            'timeout' => 15,
        ] );
        if ( is_wp_error( $res ) ) {
            return new WP_Error( 'E_BILLING_NETWORK', $res->get_error_message(), [ 'status' => 502 ] );
        }
        $code = wp_remote_retrieve_response_code( $res );
        $json = json_decode( wp_remote_retrieve_body( $res ), true );
        if ( $code >= 400 || ! is_array( $json ) || empty( $json['url'] ) ) {
            $msg = is_array( $json ) && isset( $json['error']['message'] ) ? $json['error']['message'] : 'Stripe error';
            return new WP_Error( 'E_BILLING_UPSTREAM', $msg, [ 'status' => 502 ] );
        }
        return [ 'url' => $json['url'], 'id' => $json['id'] ?? '' ];
    }

    public static function rest_portal( WP_REST_Request $req ) {
        if ( ! self::is_configured() ) {
            return new WP_Error( 'E_BILLING_NOT_CONFIGURED', 'Billing is not configured.', [ 'status' => 503 ] );
        }
        $user = wp_get_current_user();
        $customer = get_user_meta( $user->ID, self::META_CUSTOMER, true );
        if ( ! $customer ) {
            return new WP_Error( 'E_BILLING_NO_CUSTOMER', 'No Stripe customer for this user yet.', [ 'status' => 404 ] );
        }
        $return_url = esc_url_raw( $req->get_param( 'return_url' ) ?: admin_url( 'admin.php?page=inspect-page' ) );
        $res = wp_remote_post( 'https://api.stripe.com/v1/billing_portal/sessions', [
            'headers' => [
                'Authorization' => 'Bearer ' . self::secret(),
                'Content-Type'  => 'application/x-www-form-urlencoded',
            ],
            'body' => [ 'customer' => $customer, 'return_url' => $return_url ],
            'timeout' => 15,
        ] );
        if ( is_wp_error( $res ) ) {
            return new WP_Error( 'E_BILLING_NETWORK', $res->get_error_message(), [ 'status' => 502 ] );
        }
        $json = json_decode( wp_remote_retrieve_body( $res ), true );
        if ( empty( $json['url'] ) ) {
            return new WP_Error( 'E_BILLING_UPSTREAM', 'Could not open billing portal.', [ 'status' => 502 ] );
        }
        return [ 'url' => $json['url'] ];
    }

    public static function rest_status( WP_REST_Request $req ) {
        $user = wp_get_current_user();
        $has_license   = InspectPage_License::has_license( $user->ID );
        $lifetime_used = InspectPage_License::lifetime_used( $user->ID );
        $free_limit    = InspectPage_License::free_limit();
        $remaining     = $has_license ? null : max( 0, $free_limit - $lifetime_used );
        return [
            'has_license'   => $has_license,
            'plan'          => $has_license ? 'pro' : 'free',
            'configured'    => self::is_configured(),
            'subscription'  => (string) get_user_meta( $user->ID, self::META_SUB, true ),
            'lifetime_used' => $lifetime_used,
            'free_limit'    => $free_limit,
            'remaining'     => $remaining,
        ];
    }

    public static function rest_webhook( WP_REST_Request $req ) {
        $secret = self::webhook_secret();
        if ( ! $secret ) {
            return new WP_REST_Response( [ 'error' => 'webhook secret not configured' ], 503 );
        }
        $payload = $req->get_body();
        $sig_header = isset( $_SERVER['HTTP_STRIPE_SIGNATURE'] )
            ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_STRIPE_SIGNATURE'] ) )
            : '';
        if ( ! self::verify_signature( $payload, $sig_header, $secret ) ) {
            return new WP_REST_Response( [ 'error' => 'bad signature' ], 400 );
        }
        $event = json_decode( $payload, true );
        if ( ! is_array( $event ) || empty( $event['type'] ) ) {
            return new WP_REST_Response( [ 'error' => 'bad payload' ], 400 );
        }
        self::handle_event( $event );
        return new WP_REST_Response( [ 'received' => true ], 200 );
    }

    private static function verify_signature( $payload, $header, $secret ) {
        if ( ! $header ) return false;
        $parts = [];
        foreach ( explode( ',', $header ) as $kv ) {
            $kv = trim( $kv );
            $eq = strpos( $kv, '=' );
            if ( $eq === false ) continue;
            $parts[ substr( $kv, 0, $eq ) ][] = substr( $kv, $eq + 1 );
        }
        if ( empty( $parts['t'][0] ) || empty( $parts['v1'] ) ) return false;
        $t = $parts['t'][0];
        if ( abs( time() - (int) $t ) > 300 ) return false;
        $expected = hash_hmac( 'sha256', $t . '.' . $payload, $secret );
        foreach ( $parts['v1'] as $candidate ) {
            if ( hash_equals( $expected, $candidate ) ) return true;
        }
        return false;
    }

    private static function handle_event( array $event ) {
        $type = $event['type'];
        $obj  = $event['data']['object'] ?? [];
        $uid  = self::user_id_from_object( $obj );
        if ( ! $uid ) return;

        switch ( $type ) {
            case 'checkout.session.completed':
                if ( ! empty( $obj['customer'] ) )      update_user_meta( $uid, self::META_CUSTOMER, $obj['customer'] );
                if ( ! empty( $obj['subscription'] ) )  update_user_meta( $uid, self::META_SUB, $obj['subscription'] );
                self::activate( $uid );
                break;
            case 'invoice.paid':
            case 'invoice.payment_succeeded':
                self::activate( $uid );
                break;
            case 'customer.subscription.deleted':
            case 'invoice.payment_failed':
                self::deactivate( $uid );
                break;
            case 'customer.subscription.updated':
                $status = $obj['status'] ?? '';
                if ( in_array( $status, [ 'active', 'trialing' ], true ) ) self::activate( $uid );
                else self::deactivate( $uid );
                break;
        }
    }

    private static function user_id_from_object( $obj ) {
        if ( isset( $obj['metadata']['wp_user_id'] ) )  return (int) $obj['metadata']['wp_user_id'];
        if ( isset( $obj['client_reference_id'] ) )     return (int) $obj['client_reference_id'];
        if ( ! empty( $obj['customer'] ) ) {
            $users = get_users( [
                'meta_key'   => self::META_CUSTOMER,
                'meta_value' => $obj['customer'],
                'number'     => 1,
                'fields'     => 'ID',
            ] );
            if ( $users ) return (int) $users[0];
        }
        return 0;
    }

    private static function activate( $uid ) {
        update_user_meta( $uid, InspectPage_License::META_KEY, 'active' );
    }
    private static function deactivate( $uid ) {
        delete_user_meta( $uid, InspectPage_License::META_KEY );
    }
}
