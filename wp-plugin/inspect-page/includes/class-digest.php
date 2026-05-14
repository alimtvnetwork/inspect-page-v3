<?php
/**
 * Inspect Page weekly digest (v2.5.0).
 *
 * Sends each WP user a summary of their Smart Share sessions that expired
 * in the previous 7 days, with one-click unsubscribe and a Free vs Pro
 * footer. Scheduled via WP-Cron (`inspect_page_weekly_digest`, weekly).
 * Per-user opt-out lives in user_meta key `inspect_page_digest_optout`.
 *
 * The digest only emails users who actually had ≥1 expired session in the
 * window — no "you have 0 expired sessions" noise. Fully no-op when
 * `wp_mail` cannot send (e.g. dev environments without an SMTP transport).
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class InspectPage_Digest {

    const HOOK            = 'inspect_page_weekly_digest';
    const HOOK_DAILY      = 'inspect_page_daily_digest';
    const OPTOUT_META     = 'inspect_page_digest_optout';
    const TOKEN_META      = 'inspect_page_digest_token';
    const RUN_OPTION      = 'inspect_page_digest_last_run';
    const CADENCE_META    = 'inspect_page_digest_cadence';
    const LAST_OPEN_META  = 'inspect_page_digest_last_open';
    const OPEN_COUNT_META = 'inspect_page_digest_open_count';
    const OPEN_LOG_META   = 'inspect_page_digest_open_log';   // JSON list of UTC timestamps (last 30 d)
    const WINDOW_DAYS     = 7;
    const MAX_PER_USER    = 50; // cap rendered rows; rest counted in summary

    /** Allowed cadence values. `daily` is Pro-only (enforced in setter). */
    const CADENCE_WEEKLY = 'weekly';
    const CADENCE_DAILY  = 'daily';

    public static function register() {
        add_action( self::HOOK, [ __CLASS__, 'run' ] );
        add_action( self::HOOK_DAILY, [ __CLASS__, 'run_daily' ] );
        add_filter( 'cron_schedules', [ __CLASS__, 'add_weekly_schedule' ] );
        add_action( 'rest_api_init', [ __CLASS__, 'register_pixel_route' ] );
    }

    /** REST: 1×1 PNG that records an "open" against $token. */
    public static function register_pixel_route() {
        register_rest_route( INSPECT_PAGE_REST_NS, '/digest/open/(?P<token>[A-Za-z0-9]{24,64})\.png', [
            'methods'             => 'GET',
            'callback'            => [ __CLASS__, 'serve_open_pixel' ],
            'permission_callback' => '__return_true',
        ] );
    }

    /** Provide a 'weekly' interval for older WP installs that lack one. */
    public static function add_weekly_schedule( $schedules ) {
        if ( ! isset( $schedules['weekly'] ) ) {
            $schedules['weekly'] = [
                'interval' => 7 * DAY_IN_SECONDS,
                'display'  => __( 'Once Weekly', 'inspect-page' ),
            ];
        }
        return $schedules;
    }

    // ------------------------------------------------------------------
    // Cadence helpers (D2)
    // ------------------------------------------------------------------
    public static function cadence_for( $user_id ) {
        $val = (string) get_user_meta( (int) $user_id, self::CADENCE_META, true );
        return ( $val === self::CADENCE_DAILY ) ? self::CADENCE_DAILY : self::CADENCE_WEEKLY;
    }

    /** Server-side enforcement: only Pro users can opt into daily. */
    public static function set_cadence( $user_id, $cadence ) {
        $uid = (int) $user_id;
        $is_pro = class_exists( 'InspectPage_License' ) && InspectPage_License::has_license( $uid );
        if ( $cadence === self::CADENCE_DAILY && $is_pro ) {
            update_user_meta( $uid, self::CADENCE_META, self::CADENCE_DAILY );
        } else {
            delete_user_meta( $uid, self::CADENCE_META );
        }
    }

    /**
     * Find users with expired sessions in the last WINDOW_DAYS days, render
     * a digest, and email each one. Returns count of digests sent.
     */
    public static function run() {
        return self::run_for_window( self::WINDOW_DAYS, self::CADENCE_WEEKLY );
    }

    /** Daily cron — only emails users on the `daily` cadence (Pro). */
    public static function run_daily() {
        return self::run_for_window( 1, self::CADENCE_DAILY );
    }

    private static function run_for_window( $window_days, $only_cadence ) {
        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        $expired_id = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM {$p}share_session_statuses WHERE name = %s",
            InspectPage_SessionStatus::EXPIRED
        ) );
        if ( ! $expired_id ) { update_option( self::RUN_OPTION, time(), false ); return 0; }

        $since = gmdate( 'Y-m-d H:i:s', time() - (int) $window_days * DAY_IN_SECONDS );
        $rows  = $wpdb->get_results( $wpdb->prepare(
            "SELECT user_id, session_id, source_url, expires_at
             FROM {$p}share_sessions
             WHERE status_id = %d AND expires_at >= %s
             ORDER BY user_id ASC, expires_at DESC",
            $expired_id, $since
        ) );
        if ( ! $rows ) { update_option( self::RUN_OPTION, time(), false ); return 0; }

        $by_user = [];
        foreach ( $rows as $r ) {
            $by_user[ (int) $r->user_id ][] = $r;
        }

        $sent = 0;
        foreach ( $by_user as $uid => $sessions ) {
            if ( self::user_opted_out( $uid ) ) continue;
            // Cadence routing: weekly cron skips users who opted into daily,
            // daily cron only handles those users.
            if ( self::cadence_for( $uid ) !== $only_cadence ) continue;
            if ( self::send_for_user( $uid, $sessions, (int) $window_days ) ) $sent++;
        }
        update_option( self::RUN_OPTION, time(), false );
        return $sent;
    }

    public static function user_opted_out( $user_id ) {
        return (string) get_user_meta( (int) $user_id, self::OPTOUT_META, true ) === '1';
    }

    public static function set_optout( $user_id, $optout ) {
        $uid = (int) $user_id;
        if ( $optout ) {
            update_user_meta( $uid, self::OPTOUT_META, '1' );
        } else {
            delete_user_meta( $uid, self::OPTOUT_META );
        }
    }

    /** One-token-per-user; rotated lazily so links survive multiple digests. */
    public static function token_for( $user_id ) {
        $uid = (int) $user_id;
        $tok = (string) get_user_meta( $uid, self::TOKEN_META, true );
        if ( strlen( $tok ) >= 24 ) return $tok;
        $tok = wp_generate_password( 32, false, false );
        update_user_meta( $uid, self::TOKEN_META, $tok );
        return $tok;
    }

    public static function user_id_for_token( $token ) {
        if ( strlen( (string) $token ) < 24 ) return 0;
        global $wpdb;
        $uid = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT user_id FROM {$wpdb->usermeta} WHERE meta_key = %s AND meta_value = %s LIMIT 1",
            self::TOKEN_META, $token
        ) );
        return $uid;
    }

    private static function send_for_user( $user_id, $sessions, $window_days = self::WINDOW_DAYS ) {
        $user = get_user_by( 'id', (int) $user_id );
        if ( ! $user || empty( $user->user_email ) ) return false;

        $count   = count( $sessions );
        $shown   = array_slice( $sessions, 0, self::MAX_PER_USER );
        $rest    = max( 0, $count - count( $shown ) );

        $lines = [];
        $lines[] = sprintf(
            /* translators: 1: display name, 2: count, 3: window-days */
            __( "Hi %1\$s,\n\nIn the last %3\$d days, %2\$d Smart Share session(s) on your Inspect Page account expired and are no longer reachable:", 'inspect-page' ),
            $user->display_name, $count, (int) $window_days
        );
        $lines[] = '';
        foreach ( $shown as $s ) {
            $when = gmdate( 'Y-m-d H:i \U\T\C', strtotime( $s->expires_at . ' UTC' ) );
            $url  = $s->source_url ? $s->source_url : '(no source URL)';
            $lines[] = sprintf( '  · %s — expired %s', $url, $when );
        }
        if ( $rest > 0 ) {
            $lines[] = sprintf( __( '  …and %d more.', 'inspect-page' ), $rest );
        }
        $lines[] = '';

        if ( class_exists( 'InspectPage_License' ) ) {
            $sum = InspectPage_License::summary( (int) $user_id );
            if ( ! empty( $sum['has_license'] ) ) {
                $lines[] = __( "You're on Inspect Page Pro — Smart Share is unlimited. Manage subscription: https://inspectpage.app/account", 'inspect-page' );
            } else {
                $lines[] = sprintf(
                    /* translators: 1: used, 2: limit */
                    __( "You've used %1\$d of %2\$d free Smart Share links. Upgrade to Pro for unlimited shares: https://inspectpage.app/#pricing", 'inspect-page' ),
                    (int) ( $sum['lifetime_used'] ?? 0 ),
                    (int) ( $sum['free_limit']   ?? 5 )
                );
            }
            $lines[] = '';
        }

        $tok = self::token_for( $user_id );
        $lines[] = sprintf(
            __( "Don't want these? One-click unsubscribe: %s", 'inspect-page' ),
            home_url( '/?inspect_page_digest_unsubscribe=' . rawurlencode( $tok ) )
        );

        $subject = sprintf(
            /* translators: %d expired-session count */
            __( 'Your Inspect Page weekly digest — %d session(s) expired', 'inspect-page' ),
            $count
        );
        $text = implode( "\n", $lines );
        // Multipart with embedded 1×1 open-rate pixel. The plain-text part is
        // the canonical body — older clients without HTML still see the same
        // content. Pixel URL carries the same per-user token used for
        // unsubscribe; rotates when the user opts out + back in.
        $pixel  = rest_url( INSPECT_PAGE_REST_NS . '/digest/open/' . rawurlencode( $tok ) . '.png' );
        $html   = '<pre style="font:14px/1.5 -apple-system,Segoe UI,sans-serif;white-space:pre-wrap">'
                . esc_html( $text )
                . '</pre>'
                . '<img src="' . esc_url( $pixel ) . '" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" />';
        $boundary = 'inspect-page-' . md5( $user->user_email . $count . microtime( true ) );
        $headers  = [
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        ];
        $body  = "--$boundary\r\n";
        $body .= "Content-Type: text/plain; charset=UTF-8\r\n\r\n" . $text . "\r\n\r\n";
        $body .= "--$boundary\r\n";
        $body .= "Content-Type: text/html; charset=UTF-8\r\n\r\n" . $html . "\r\n\r\n";
        $body .= "--$boundary--\r\n";
        return (bool) wp_mail( $user->user_email, $subject, $body, $headers );
    }

    /**
     * REST GET /digest/open/{token}.png — records an open against the user
     * resolved from the token, then serves a 1×1 transparent PNG. Always
     * returns 200 + an image so misbehaving clients/proxies cannot probe
     * for valid tokens via timing / status differences.
     */
    public static function serve_open_pixel( $req ) {
        $tok = (string) $req['token'];
        $uid = self::user_id_for_token( $tok );
        if ( $uid > 0 ) {
            update_user_meta( $uid, self::LAST_OPEN_META, gmdate( 'Y-m-d H:i:s' ) );
            $cur = (int) get_user_meta( $uid, self::OPEN_COUNT_META, true );
            update_user_meta( $uid, self::OPEN_COUNT_META, $cur + 1 );
            $log = json_decode( (string) get_user_meta( $uid, self::OPEN_LOG_META, true ), true );
            if ( ! is_array( $log ) ) $log = [];
            $log[] = time();
            // Trim to last 30 days.
            $cutoff = time() - 30 * DAY_IN_SECONDS;
            $log = array_values( array_filter( $log, function ( $t ) use ( $cutoff ) { return (int) $t >= $cutoff; } ) );
            update_user_meta( $uid, self::OPEN_LOG_META, wp_json_encode( $log ) );
        }
        // 43-byte 1×1 transparent PNG.
        $png = base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
        );
        header_remove( 'Cache-Control' );
        header( 'Content-Type: image/png' );
        header( 'Content-Length: ' . strlen( $png ) );
        header( 'Cache-Control: private, no-store, no-cache, must-revalidate' );
        header( 'X-Content-Type-Options: nosniff' );
        echo $png;
        exit;
    }

    /** Open count in the last 7 days, derived from OPEN_LOG_META. */
    public static function opens_last_7d( $user_id ) {
        $log = json_decode( (string) get_user_meta( (int) $user_id, self::OPEN_LOG_META, true ), true );
        if ( ! is_array( $log ) ) return 0;
        $cutoff = time() - 7 * DAY_IN_SECONDS;
        $n = 0;
        foreach ( $log as $t ) { if ( (int) $t >= $cutoff ) $n++; }
        return $n;
    }

    public static function deactivate() {
        $ts = wp_next_scheduled( self::HOOK );
        if ( $ts ) wp_unschedule_event( $ts, self::HOOK );
        $td = wp_next_scheduled( self::HOOK_DAILY );
        if ( $td ) wp_unschedule_event( $td, self::HOOK_DAILY );
    }
}