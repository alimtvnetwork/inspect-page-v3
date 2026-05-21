// This file MUST produce zero findings.

import { logger } from "./logger";

export function shipMe(rows: ReadonlyArray<{ id: number }>): void {
    for (const row of rows) {
        // structured logging via the project logger — fine
        logger.info("processed", { id: row.id });
    }
}