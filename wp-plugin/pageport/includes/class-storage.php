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

    public static function session_dir( $user_id, $session_id ) {
        return self::base_dir() . '/' . intval( $user_id ) . '/' . $session_id;
    }

    /**
     * Persist a single asset and return ['path' => abs, 'bytes' => int, 'mime' => string].
     * `$tmp_path` is the uploaded tmp file from $_FILES; copied via WP_Filesystem.
     */
    public static function store_asset( $user_id, $session_id, $kind, $tmp_path, $mime ) {
        self::ensure_root();
        $dir = self::session_dir( $user_id, $session_id );
        if ( ! wp_mkdir_p( $dir ) ) {
            return new WP_Error( PagePort_ErrorCode::E_SHARE_STORAGE, 'mkdir failed', [ 'status' => 500 ] );
        }
        $ext = self::ext_for( $kind, $mime );
        $abs = $dir . '/' . $kind . '.' . $ext;
        if ( ! @move_uploaded_file( $tmp_path, $abs ) ) {
            // Fallback for CLI / tests where move_uploaded_file rejects the source.
            if ( ! @copy( $tmp_path, $abs ) ) {
                return new WP_Error( PagePort_ErrorCode::E_SHARE_STORAGE, 'write failed', [ 'status' => 500 ] );
            }
        }
        @chmod( $abs, 0644 );
        return [ 'path' => $abs, 'bytes' => filesize( $abs ), 'mime' => $mime ];
    }

    public static function ext_for( $kind, $mime ) {
        if ( $kind === PagePort_AssetType::HTML ) return 'html';
        if ( $kind === PagePort_AssetType::CSS )  return 'css';
        if ( strpos( $mime, 'jpeg' ) !== false )  return 'jpg';
        if ( strpos( $mime, 'webp' ) !== false )  return 'webp';
        return 'png';
    }

    public static function delete_session_files( $user_id, $session_id ) {
        $dir = self::session_dir( $user_id, $session_id );
        if ( ! is_dir( $dir ) ) return;
        foreach ( glob( $dir . '/*' ) ?: [] as $f ) { @unlink( $f ); }
        @rmdir( $dir );
    }

    public static function new_session_id() {
        // 32 random bytes → 43-char base64url, no padding.
        $bin = function_exists( 'random_bytes' ) ? random_bytes( 32 ) : openssl_random_pseudo_bytes( 32 );
        return rtrim( strtr( base64_encode( $bin ), '+/', '-_' ), '=' );
    }
}