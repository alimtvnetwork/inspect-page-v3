<?php
/**
 * Inspect Page email notifications (v2.3).
 *
 * Sends two `wp_mail` notifications:
 *   - Free quota reached: triggered when a Smart Share upload is rejected with
 *     402 / E_SHARE_QUOTA_FREE. Throttled to once per 24 hours per user via
 *     a transient.
 *   - License activated: triggered when an admin sets the `inspect_page_license`
 *     user meta to "active" (transition only, not on every save).
 *
 * No-op when WP cannot send mail (e.g. missing transport) — failures are
 * logged but never raised.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class InspectPage_Notify {

    public static function register() {
        add_action( 'inspect_page_quota_blocked', [ __CLASS__, 'on_quota_blocked' ], 10, 1 );
        add_action( 'updated_user_meta',          [ __CLASS__, 'on_user_meta' ],     10, 4 );
        add_action( 'added_user_meta',            [ __CLASS__, 'on_user_meta' ],     10, 4 );
    }

    public static function on_quota_blocked( $user_id ) {
        $user_id = (int) $user_id;
        if ( $user_id <= 0 ) return;
        $key = 'inspect_page_notified_quota_' . $user_id;
        if ( get_transient( $key ) ) return;
        set_transient( $key, 1, DAY_IN_SECONDS );

        $user = get_user_by( 'id', $user_id );
        if ( ! $user || empty( $user->user_email ) ) return;

        $subject = __( 'Inspect Page — free share quota reached', 'inspect-page' );
        $summary = InspectPage_License::summary( $user_id );
        $body    = sprintf(
            /* translators: 1: name, 2: used, 3: limit */
            __( "Hi %1\$s,\n\nYou have used %2\$d of %3\$d free Smart Share links. Upgrade to Inspect Page Pro for unlimited shares:\n\n%4\$s\n\nThanks for using Inspect Page!", 'inspect-page' ),
            $user->display_name,
            $summary['lifetime_used'],
            $summary['free_limit'],
            'https://inspectpage.app/#pricing'
        );
        wp_mail( $user->user_email, $subject, $body );
    }

    /** Fires on user meta change — alert when license flips to active. */
    public static function on_user_meta( $meta_id, $object_id, $meta_key, $meta_value ) {
        if ( $meta_key !== InspectPage_License::META_KEY ) return;
        if ( strtolower( (string) $meta_value ) !== 'active' ) return;
        $user = get_user_by( 'id', (int) $object_id );
        if ( ! $user || empty( $user->user_email ) ) return;

        // Avoid duplicate emails on no-op meta saves.
        $sent_key = 'inspect_page_license_emailed';
        if ( (string) get_user_meta( $user->ID, $sent_key, true ) === 'active' ) return;
        update_user_meta( $user->ID, $sent_key, 'active' );

        $subject = __( 'Inspect Page — Pro plan activated', 'inspect-page' );
        $body    = sprintf(
            /* translators: 1: display name */
            __( "Hi %1\$s,\n\nYour Inspect Page Pro plan is now active. Smart Share is unlimited from your account.\n\nEnjoy!", 'inspect-page' ),
            $user->display_name
        );
        wp_mail( $user->user_email, $subject, $body );
    }
}