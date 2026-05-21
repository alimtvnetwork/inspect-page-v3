<?php
// This file MUST produce zero findings.

function shipMe(array $rows): void {
    foreach ($rows as $row) {
        // structured logging via the project logger — fine
        Logger::info('processed', ['id' => $row['Id']]);
    }
}
