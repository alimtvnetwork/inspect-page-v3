// CODE-RED-005 boundary fixture — DO NOT FIX.
//
// Body has EXACTLY 15 effective lines — the upper edge of the
// prefer-band (9–15). Per the policy documented in
// `linters-cicd/checks/function-length-prefer8/_shared.py`:
//
//   * 0–8  effective lines → both rules silent
//   * 9–15 effective lines → CODE-RED-005 errors, CODE-RED-004 silent
//   * 16+  effective lines → both rules error
//
// Therefore this 15-line body MUST:
//   * trigger ONE CODE-RED-005 SARIF `error` (strict cap = 8), and
//   * stay silent under CODE-RED-004 (hard cap = 15, exclusive of equal).
//
// Asserted by `linters-cicd/tests/test_prefer8_fires_on_fixture.py`.
// Excluded from real linter runs via ESLint's `ignores` and the
// fixture directory convention.
export function fixtureAtCap15(items: number[]): number {
  let total = 0;
  let positive = 0;
  let negative = 0;
  let zeroes = 0;
  let evens = 0;
  let maxSeen = 0;
  for (const value of items) {
    total += value;
    if (value > 0) positive += 1;
    if (value < 0) negative += 1;
    if (value === 0) zeroes += 1;
    if (value % 2 === 0) evens += 1;
    if (value > maxSeen) maxSeen = value;
  }
  return total + positive - negative + zeroes + evens + maxSeen;
}
