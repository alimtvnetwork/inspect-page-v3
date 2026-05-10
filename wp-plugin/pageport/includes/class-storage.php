<?php
/**
 * Filesystem helpers. Stub — real upload logic lands in V5.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class PagePort_Storage {

    public static function base_dir() {
        $up = wp_upload_dir();
        return trailingslashit( $up['basedir'] ) . 'pageport';
    }

    public static function base_url() {
        $up = wp_upload_dir();
        return trailingslashit( $up['baseurl'] ) . 'pageport';
    }

    public static function ensure_root() {
        $dir = self::base_dir();
        if ( ! file_exists( $dir ) ) { wp_mkdir_p( $dir ); }
        $ht = $dir . '/.htaccess';
        if ( ! file_exists( $ht ) ) {
            file_put_contents( $ht, "<FilesMatch \"^(?!html\\.|css\\.|image\\.).*$\">\nDeny from all\n</FilesMatch>\n" );
        }
    }
}