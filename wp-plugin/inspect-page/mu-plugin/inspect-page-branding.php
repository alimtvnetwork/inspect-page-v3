<?php
/**
 * Inspect Page Login Branding (optional mu-plugin)
 *
 * Drop this file into wp-content/mu-plugins/ (create the folder if it doesn't
 * exist) to lightly theme the WordPress login page so it feels like part of
 * Inspect Page rather than a generic WP admin screen.
 *
 * What it does:
 *   - Replaces the WP logo with "Inspect Page" text.
 *   - Updates the logo link to the site homepage.
 *   - Adds a soft color theme (uses WP admin colors by default; override below).
 *   - Surfaces a "Create account" link when open registration is enabled.
 *
 * Installation:
 *   1. Copy this file to wp-content/mu-plugins/inspect-page-branding.php
 *   2. No activation needed — mu-plugins load automatically.
 *   3. To remove, simply delete the file.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

add_action( 'login_enqueue_scripts', function () {
    $primary = '#0969da'; // GitHub-blue-ish; change to your brand color
    $primary_dark = '#0550ae';
    ?>
    <style>
    #login h1 a {
      background-image: none !important;
      text-indent: 0 !important;
      width: auto !important;
      height: auto !important;
      font-size: 22px !important;
      font-weight: 700 !important;
      color: #1f2328 !important;
      text-decoration: none !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 8px !important;
    }
    #login h1 a::before {
      content: "";
      display: inline-block;
      width: 28px;
      height: 28px;
      background: <?php echo esc_html( $primary ); ?>;
      mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat;
      -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat;
    }
    .login {
      background: #f6f8fa !important;
    }
    #loginform, #registerform, #lostpasswordform {
      border: 1px solid #d0d7de !important;
      border-radius: 8px !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04) !important;
    }
    .wp-core-ui .button-primary {
      background: <?php echo esc_html( $primary ); ?> !important;
      border-color: <?php echo esc_html( $primary ); ?> !important;
    }
    .wp-core-ui .button-primary:hover, .wp-core-ui .button-primary:focus {
      background: <?php echo esc_html( $primary_dark ); ?> !important;
      border-color: <?php echo esc_html( $primary_dark ); ?> !important;
    }
    </style>
    <?php
} );

add_filter( 'login_headerurl', function ( $url ) {
    return home_url( '/' );
} );

add_filter( 'login_headertext', function ( $title ) {
    return __( 'Inspect Page', 'inspect-page' );
} );

/**
 * When open registration is enabled, add a friendly "Create account" link
 * below the login form so new users don't have to hunt for it.
 */
add_action( 'login_footer', function () {
    if ( ! get_option( 'users_can_register' ) ) {
        return;
    }
    $register_url = wp_registration_url();
    echo '<div style="max-width:320px;margin:12px auto 0;text-align:center;font-size:13px;color:#57606a;">';
    echo esc_html__( 'New to Inspect Page?', 'inspect-page' ) . ' ';
    echo '<a href="' . esc_url( $register_url ) . '" style="color:#0969da;font-weight:500;">' . esc_html__( 'Create an account', 'inspect-page' ) . '</a>';
    echo '</div>';
} );
