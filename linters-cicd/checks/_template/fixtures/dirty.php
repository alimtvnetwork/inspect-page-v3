<?php
// This file is a fixture for TEMPLATE-001 tests.
// It MUST trigger findings — do not "clean up" the violations.

function debugMe(array $rows): void {
    var_dump($rows);                 // ← TEMPLATE-001 (warning, line 6)
    print_r($rows, true);            // ← TEMPLATE-001 (warning, line 7)
    error_log("Got " . count($rows));// ← TEMPLATE-001 (warning, line 8)
}

// The next call is in a comment — must NOT be flagged.
// var_dump('not a real call');  ← NO-FINDING
