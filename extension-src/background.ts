/**
 * Service worker entry. Stage 0 stub — message router added in Stage 2.
 */
import { logger } from "@shared/logger";
import { LogCategory } from "@shared/enums";

logger.info(LogCategory.Lifecycle, `Service worker booted v${__EXT_VERSION__}`);
