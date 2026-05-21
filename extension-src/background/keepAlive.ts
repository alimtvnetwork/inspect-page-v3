/**
 * MV3 service-worker keep-alive (spec R12 / E20).
 *
 * Uses chrome.alarms (NOT setInterval) plus a self-loop Port to pin the SW
 * across long exports. The alarm cadence (30s by default) covers Chromium's
 * 30s idle-suspend window; the Port adds belt-and-suspenders.
 *
 * Extracted from background.ts per spec R7 (≤100 lines per file).
 */
import { KEEPALIVE_INTERVAL_MS } from "@shared/constants";

const KEEPALIVE_ALARM_NAME = "inspect-page-keepalive";
const KEEPALIVE_ALARM_PERIOD_MIN = Math.max(KEEPALIVE_INTERVAL_MS / 60_000, 0.5);
let keepAliveCount = 0;
let keepAlivePort: chrome.runtime.Port | null = null;

function openKeepAlivePort(): void {
  try {
    keepAlivePort = chrome.runtime.connect({ name: KEEPALIVE_ALARM_NAME });
    keepAlivePort.onDisconnect.addListener(() => {
      keepAlivePort = null;
      if (keepAliveCount > 0) openKeepAlivePort();
    });
  } catch { /* alarm-based fallback handles it */ }
}

export function startKeepAlive(): void {
  keepAliveCount++;
  if (keepAlivePort) return;
  openKeepAlivePort();
  chrome.alarms.create(KEEPALIVE_ALARM_NAME, { periodInMinutes: KEEPALIVE_ALARM_PERIOD_MIN });
}

export function stopKeepAlive(): void {
  keepAliveCount = Math.max(0, keepAliveCount - 1);
  if (keepAliveCount !== 0) return;
  chrome.alarms.clear(KEEPALIVE_ALARM_NAME).catch(() => undefined);
  if (keepAlivePort) {
    try { keepAlivePort.disconnect(); } catch { /* noop */ }
    keepAlivePort = null;
  }
}

// Wake the SW on alarm tick with a cheap async chrome.* call.
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== KEEPALIVE_ALARM_NAME) return;
  chrome.runtime.getPlatformInfo().catch(() => undefined);
});

// Absorb the no-op port on the receiving end so Chromium keeps it alive.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== KEEPALIVE_ALARM_NAME) return;
  port.onMessage.addListener(() => undefined);
});
