// Fixture for codegen determinism test (Task #05).
// DO NOT modify without regenerating expected/ via:
//   bash linters-cicd/codegen/scripts/regen-codegen-fixtures.sh
//
// Covers: canonical-table inverse (IsActive), fallback (HasLicense),
// and a second struct in the same file to exercise multi-block emit.

package models

type User struct {
	UserId     int64 `db:"UserId"`
	IsActive   bool  `db:"IsActive"`
	HasLicense bool  `db:"HasLicense"`
}

type Subscription struct {
	SubscriptionId int64 `db:"SubscriptionId"`
	IsEnabled      bool  `db:"IsEnabled"`
	IsVerified     bool  `db:"IsVerified"`
}
