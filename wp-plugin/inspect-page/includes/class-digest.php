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
    const OPTOUT_META     = 'inspect_page_digest_optout';
    const TOKEN_META      = 'inspect_page_digest_token';
    const RUN_OPTION      = 'inspect_page_digest_last_run';
    const WINDOW_DAYS     = 7;
    const MAX_PER_USER    = 50; // cap rendered rows; rest counted in summary

    public static function register() {
        add_action( self::HOOK, [ __CLASS__, 'run' ] );
        add_filter( 'cron_schedules', [ __CLASS__, 'add_weekly_schedule' ] );
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

    /**
     * Find users with expired sessions in the last WINDOW_DAYS days, render
     * a digest, and email each one. Returns count of digests sent.
     */
    public static function run() {
        global $wpdb;
        $p = $wpdb->prefix . 'pp_';
        $expired_id = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM {$p}share_session_statuses WHERE name = %s",
            InspectPage_SessionStatus::EXPIRED
        ) );
        if ( ! $expired_id ) { update_option( self::RUN_OPTION, time(), false ); return 0; }

        $since = gmdate( 'Y-m-d H:i:s', time() - self::WINDOW_DAYS * DAY_IN_SECONDS );
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
            if ( self::send_for_user( $uid, $sessions ) ) $sent++;
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

    private static function send_for_user( $user_id, $sessions ) {
        $user = get_user_by( 'id', (int) $user_id );
        if ( ! $user || empty( $user->user_email ) ) return false;

        $count   = count( $sessions );
        $shown   = array_slice( $sessions, 0, self::MAX_PER_USER );
        $rest    = max( 0, $count - count( $shown ) );

        $lines = [];
        $lines[] = sprintf(
            /* translators: 1: display name, 2: count, 3: window-days */
            __( "Hi %1\$s,\n\nIn the last %3\$d days, %2\$d Smart Share session(s) on your Inspect Page account expired and are no longer reachable:", 'inspect-page' ),
            $user->display_name, $count, self::WINDOW_DAYS
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
        $body = implode( "\n", $lines );
        return (bool) wp_mail( $user->user_email, $subject, $body );
    }

    public static function deactivate() {
        $ts = wp_next_scheduled( self::HOOK );
        if ( $ts ) wp_unschedule_event( $ts, self::HOOK );
    }
}