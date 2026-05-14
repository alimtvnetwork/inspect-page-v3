<?php
/**
 * Const-class enums mirroring `extension-src/shared/enums.ts` where relevant.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

final class InspectPage_SessionStatus {
    const ACTIVE  = 'Active';
    const EXPIRED = 'Expired';
    const REVOKED = 'Revoked';

    public static function all() {
        return [ self::ACTIVE, self::EXPIRED, self::REVOKED ];
    }
}

final class InspectPage_SessionKind {
    const FULL_PAGE = 'FullPage';
    const ELEMENT   = 'Element';

    public static function all() {
        return [ self::FULL_PAGE, self::ELEMENT ];
    }
}

final class InspectPage_AssetType {
    const HTML  = 'html';
    const CSS   = 'css';
    const JS    = 'js';
    const IMAGE = 'image';

    public static function all() {
        return [ self::HTML, self::CSS, self::JS, self::IMAGE ];
    }
}

final class InspectPage_ErrorCode {
    const E_SHARE_AUTH       = 'E_SHARE_AUTH';
    const E_SHARE_NETWORK    = 'E_SHARE_NETWORK';
    const E_SHARE_UPSTREAM   = 'E_SHARE_UPSTREAM';
    const E_SHARE_NOT_FOUND  = 'E_SHARE_NOT_FOUND';
    const E_SHARE_EXPIRED    = 'E_SHARE_EXPIRED';
    const E_SHARE_FORBIDDEN  = 'E_SHARE_FORBIDDEN';
    const E_SHARE_BAD_INPUT  = 'E_SHARE_BAD_INPUT';
    const E_SHARE_STORAGE    = 'E_SHARE_STORAGE';
    const E_SHARE_QUOTA      = 'E_SHARE_QUOTA';
    const E_SHARE_QUOTA_FREE = 'E_SHARE_QUOTA_FREE';
    const E_SHARE_BAD_TOKEN  = 'E_SHARE_BAD_TOKEN';
    const E_PRO_REQUIRED     = 'E_PRO_REQUIRED';
}