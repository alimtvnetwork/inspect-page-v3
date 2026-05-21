// Fixture for codegen determinism test (Task #05).
// DO NOT modify without regenerating expected/ via:
//   bash linters-cicd/codegen/scripts/regen-codegen-fixtures.sh

export class User {
  @DbField('UserId') readonly UserId!: number;
  @DbField('IsActive') readonly IsActive!: boolean;
  @DbField('HasLicense') readonly HasLicense!: boolean;
}

export class Subscription {
  @DbField('SubscriptionId') readonly SubscriptionId!: number;
  @DbField('IsEnabled') readonly IsEnabled!: boolean;
  @DbField('IsVerified') readonly IsVerified!: boolean;
}
