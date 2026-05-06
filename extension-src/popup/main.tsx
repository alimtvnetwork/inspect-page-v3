/**
 * Popup entry. Stage 0 stub — <ExportPanel /> mounted in Stage 3.
 */
import { logger } from "@shared/logger";
import { LogCategory } from "@shared/enums";

logger.debug(LogCategory.Lifecycle, "Popup loaded");
const root = document.getElementById("root");
if (root) {
  root.textContent = "LLM Page Export — UI in Stage 3.";
}
