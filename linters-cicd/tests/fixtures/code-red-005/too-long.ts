// CODE-RED-005 fixture — DO NOT FIX.
//
// This file intentionally violates the "prefer ≤ 8 effective lines per
// function body" rule (CODE-RED-005, "FunctionLengthPrefer8") with a
// 12-line function body. It MUST stay in the prefer-band (9–15 lines)
// so that:
//   * the linters-cicd `function-length-prefer8/typescript.py` scanner
//     emits a SARIF `warning`, and
//   * the ESLint `coding-guidelines/prefer-function-lines` rule reports.
//
// Asserted by `linters-cicd/tests/test_prefer8_fires_on_fixture.py`.
// Excluded from real linter runs via `linters-cicd/load-config.json`
// and ESLint's `ignores` (see eslint.config.js).
export function fixtureTooLongPrefer8(items: number[]): number {
  let total = 0;
  let positive = 0;
  let negative = 0;
  let zeroes = 0;
  for (const value of items) {
    total += value;
    if (value > 0) positive += 1;
    if (value < 0) negative += 1;
    if (value === 0) zeroes += 1;
  }
  return total + positive - negative + zeroes;
}
