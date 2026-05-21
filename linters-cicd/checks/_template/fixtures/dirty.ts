// This file is a fixture for TEMPLATE-001 tests (TypeScript sibling
// of dirty.php). It MUST trigger findings — do not "clean up" the
// violations.

export function debugMe(rows: ReadonlyArray<{ id: number }>): void {
    console.log("processing", rows.length);   // ← TEMPLATE-001 (warning, line 6)
    console.debug({ rows });                  // ← TEMPLATE-001 (warning, line 7)
    if (rows.length === 0) {
        debugger;                             // ← TEMPLATE-001 (warning, line 9)
    }
    console.error(`failed for ${rows[0]?.id}`); // ← TEMPLATE-001 (warning, line 11)
}

// The next call is in a comment — must NOT be flagged.
// console.log('not a real call');

// The next call is in a string — must NOT be flagged.
const reminder = "remember to remove console.log before shipping";

// A function with a similar name — must NOT be flagged.
function myConsoleLogWrapper(): void { /* no-op */ }
myConsoleLogWrapper();