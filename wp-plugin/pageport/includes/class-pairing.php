<?php
/**
 * PagePort pairing-token issuance, verification, and revocation.
 *
 * Token format (printable, single paste):
 *   PPT1.<base64url(payload_json)>.<base64url(hmac_sha256(payload_json, key))>
 *
 * Payload fields: { v:1, site, tid, uid, iat, exp:null }
 * The server only trusts `tid` after HMAC verification — `site` and `uid`
 * are convenience fields the extension reads at pair time so the user
 * never has to type the WordPress URL.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class PagePort_Pairing {

    const TABLE_SUFFIX = 'pp_pairing_tokens';
    const PREFIX       = 'PPT1.';

    /** Mint a new token for the current user. Returns the printable token string. */
    public static function mint( $user_id, $label = '' ) {
        global $wpdb;
        $table = $wpdb->prefix . self::TABLE_SUFFIX;
        $tid   = self::random_id( 16 ); // 22 base64url chars
        $now   = current_time( 'mysql', true );

        $ok = $wpdb->insert( $table, [
            'tid'        => $tid,
            'user_id'    => (int) $user_id,
            'label'      => self::clean_label( $label ),
            'created_at' => $now,
        ] );
        if ( ! $ok ) {
            return new WP_Error( PagePort_ErrorCode::E_SHARE_STORAGE, 'mint failed', [ 'status' => 500 ] );
        }

        $payload = [
            'v'    => 1,
            'site' => self::canonical_site_url(),
            'tid'  => $tid,
            'uid'  => (int) $user_id,
            'iat'  => time(),
            'exp'  => null,
        ];
        return self::encode( $payload );
    }

    /** Verify a printable token. Returns row stdClass on success, WP_Error otherwise. */
    public static function verify( $token ) {
        if ( ! is_string( $token ) || strpos( $token, self::PREFIX ) !== 0 ) {
            return new WP_Error( PagePort_ErrorCode::E_SHARE_AUTH, 'bad token format', [ 'status' => 401 ] );
        }
        $parts = explode( '.', substr( $token, strlen( self::PREFIX ) ) );
        if ( count( $parts ) !== 2 ) {
            return new WP_Error( PagePort_ErrorCode::E_SHARE_AUTH, 'bad token shape', [ 'status' => 401 ] );
        }
        list( $payload_b64, $sig_b64 ) = $parts;
        $payload_json = self::b64url_decode( $payload_b64 );
        $sig          = self::b64url_decode( $sig_b64 );
        if ( $payload_json === false || $sig === false ) {
            return new WP_Error( PagePort_ErrorCode::E_SHARE_AUTH, 'bad token encoding', [ 'status' => 401 ] );
        }
        $expected = hash_hmac( 'sha256', $payload_json, self::signing_key(), true );
        if ( ! hash_equals( $expected, $sig ) ) {
            return new WP_Error( PagePort_ErrorCode::E_SHARE_AUTH, 'bad token signature', [ 'status' => 401 ] );
        }
        $payload = json_decode( $payload_json, true );
        if ( ! is_array( $payload ) || empty( $payload['tid'] ) || empty( $payload['uid'] ) ) {
            return new WP_Error( PagePort_ErrorCode::E_SHARE_AUTH, 'bad token payload', [ 'status' => 401 ] );
        }

        global $wpdb;
        $table = $wpdb->prefix . self::TABLE_SUFFIX;
        $row = $wpdb->get_row( $wpdb->prepare(
            "SELECT id, tid, user_id, label, revoked_at FROM {$table} WHERE tid = %s LIMIT 1",
            $payload['tid']
        ) );
        if ( ! $row ) {
            return new WP_Error( PagePort_ErrorCode::E_SHARE_AUTH, 'unknown token', [ 'status' => 401 ] );
        }
        if ( ! empty( $row->revoked_at ) ) {
            return new WP_Error( PagePort_ErrorCode::E_SHARE_AUTH, 'revoked', [ 'status' => 401 ] );
        }
        if ( (int) $row->user_id !== (int) $payload['uid'] ) {
            return new WP_Error( PagePort_ErrorCode::E_SHARE_AUTH, 'uid mismatch', [ 'status' => 401 ] );
        }
        // Touch last_used_at (best-effort).
        $wpdb->update( $table, [ 'last_used_at' => current_time( 'mysql', true ) ], [ 'id' => $row->id ] );
        return $row;
    }

    /** Revoke by row id (admin) or by tid (extension). */
    public static function revoke_by_tid( $tid, $acting_user_id ) {
        global $wpdb;
        $table = $wpdb->prefix . self::TABLE_SUFFIX;
        $row = $wpdb->get_row( $wpdb->prepare(
            "SELECT id, user_id FROM {$table} WHERE tid = %s LIMIT 1", $tid
        ) );
        if ( ! $row ) return false;
        if ( (int) $row->user_id !== (int) $acting_user_id && ! user_can( $acting_user_id, 'manage_options' ) ) {
            return false;
        }
        $wpdb->update( $table, [ 'revoked_at' => current_time( 'mysql', true ) ], [ 'id' => $row->id ] );
        return true;
    }

    public static function list_for_user( $user_id ) {
        global $wpdb;
        $table = $wpdb->prefix . self::TABLE_SUFFIX;
        return $wpdb->get_results( $wpdb->prepare(
            "SELECT tid, label, created_at, last_used_at, revoked_at
             FROM {$table} WHERE user_id = %d
             ORDER BY created_at DESC LIMIT 200", (int) $user_id
        ), ARRAY_A );
    }

    // ---------- helpers ----------

    public static function signing_key() {
        $key = get_option( 'pageport_signing_key' );
        if ( ! $key ) {
            $key = bin2hex( random_bytes( 32 ) );
            add_option( 'pageport_signing_key', $key, '', 'no' );
        }
        return $key;
    }

    private static function canonical_site_url() {
        return untrailingslashit( home_url( '/' ) );
    }

    private static function encode( array $payload ) {
        $json = wp_json_encode( $payload, JSON_UNESCAPED_SLASHES );
        $sig  = hash_hmac( 'sha256', $json, self::signing_key(), true );
        return self::PREFIX . self::b64url_encode( $json ) . '.' . self::b64url_encode( $sig );
    }

    private static function random_id( $bytes ) {
        return self::b64url_encode( random_bytes( $bytes ) );
    }

    private static function b64url_encode( $bin ) {
        return rtrim( strtr( base64_encode( $bin ), '+/', '-_' ), '=' );
    }

    private static function b64url_decode( $str ) {
        $pad = strlen( $str ) % 4;
        if ( $pad ) { $str .= str_repeat( '=', 4 - $pad ); }
        return base64_decode( strtr( $str, '-_', '+/' ), true );
    }

    private static function clean_label( $label ) {
        $label = sanitize_text_field( (string) $label );
        if ( strlen( $label ) > 120 ) { $label = substr( $label, 0, 120 ); }
        return $label;
    }
}