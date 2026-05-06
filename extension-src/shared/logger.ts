/**
 * Logger facade — every catch in the codebase MUST go through this.
 * Source: spec/21-app/09-error-handling.md.
 */
import { LOG_PREFIX } from "./constants";
import { LogCategory, LogLevel, ErrorCode } from "./enums";

interface LogPayload {
  level: LogLevel;
  category: LogCategory;
  code?: ErrorCode | string;
  message: string;
  error?: unknown;
}

function emit(payload: LogPayload): void {
  const head = `${LOG_PREFIX} [${payload.level}] [${payload.category}]`;
  const body = payload.code
    ? `${payload.code} ${payload.message}`
    : payload.message;
  if (payload.level === LogLevel.Error) {
    console.error(head, body, payload.error ?? "");
    return;
  }
  if (payload.level === LogLevel.Warn) {
    console.warn(head, body, payload.error ?? "");
    return;
  }
  if (payload.level === LogLevel.Info) {
    console.info(head, body);
    return;
  }
  console.debug(head, body);
}

export const logger = {
  debug(category: LogCategory, message: string): void {
    emit({ level: LogLevel.Debug, category, message });
  },
  info(category: LogCategory, message: string): void {
    emit({ level: LogLevel.Info, category, message });
  },
  warn(category: LogCategory, code: ErrorCode | string, message: string, error?: unknown): void {
    emit({ level: LogLevel.Warn, category, code, message, error });
  },
  error(category: LogCategory, code: ErrorCode | string, message: string, error?: unknown): void {
    emit({ level: LogLevel.Error, category, code, message, error });
  },
};
