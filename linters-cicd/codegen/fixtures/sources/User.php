<?php
/**
 * Fixture for codegen determinism test (Task #05).
 * DO NOT modify without regenerating expected/ via:
 *   bash linters-cicd/codegen/scripts/regen-codegen-fixtures.sh
 */

class User
{
    #[Db('UserId')]
    public int $UserId;

    #[Db('IsActive')]
    public bool $IsActive;

    #[Db('HasLicense')]
    public bool $HasLicense;
}

class Subscription
{
    #[Db('SubscriptionId')]
    public int $SubscriptionId;

    #[Db('IsEnabled')]
    public bool $IsEnabled;

    #[Db('IsVerified')]
    public bool $IsVerified;
}
