<?php
/**
 * Lightweight assertion runner for InspectPage_REST::sign_session_id().
 *
 * Usage:
 *   php wp-plugin/inspect-page/tests/test-sign-url.php
 *
 * Exits 0 on success, 1 on the first failed assertion.
 */
require __DIR__ . '/bootstrap.php';

$failures = 0;
function check( $label, $cond ) {
    global $failures;
    if ( $cond ) {
        echo "  ok   $label\n";
    } else {
        echo "  FAIL $label\n";
        $failures++;
    }
}

echo "InspectPage_REST::sign_session_id\n";

$sid = 'abcdef0123456789ABCDEF0123456789abcdef0_-X';
$sig = InspectPage_REST::sign_session_id( $sid );

// 1. Output shape: 22 url-safe base64 chars, no padding.
check( 'sig is 22 chars', strlen( $sig ) === 22 );
check( 'sig is url-safe base64', preg_match( '/^[A-Za-z0-9_-]{22}$/', $sig ) === 1 );

// 2. Deterministic for the same input + secret.
$sig2 = InspectPage_REST::sign_session_id( $sid );
check( 'deterministic round-trip', hash_equals( $sig, $sig2 ) );

// 3. Different session_id → different signature.
$other = InspectPage_REST::sign_session_id( $sid . 'X' );
check( 'different sid → different sig', ! hash_equals( $sig, $other ) );

// 4. Rotating the per-install secret invalidates old signatures.
update_option( 'inspect_page_url_secret', 'rotated-secret-value' );
$sig_after_rotation = InspectPage_REST::sign_session_id( $sid );
check( 'secret rotation changes sig', ! hash_equals( $sig, $sig_after_rotation ) );

// 5. Secret is auto-generated on first access if missing.
$GLOBALS['_pp_options'] = [];
InspectPage_REST::sign_session_id( $sid );
check( 'auto-generates secret', ! empty( $GLOBALS['_pp_options']['inspect_page_url_secret'] ) );
check( 'secret is sufficiently long', strlen( $GLOBALS['_pp_options']['inspect_page_url_secret'] ) >= 32 );

if ( $failures > 0 ) {
    echo "\n$failures assertion(s) failed.\n";
    exit( 1 );
}
echo "\nAll assertions passed.\n";
exit( 0 );