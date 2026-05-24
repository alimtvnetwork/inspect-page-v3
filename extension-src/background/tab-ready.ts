/**
 * Tab-readiness + content-script bootstrap helpers (extracted from
 * background.ts per R7 file-size split). Pure side-effect-free helpers
 * apart from the chrome.* APIs they wrap.
 */
import { ErrorCode, MessageKind } from "@shared/enums";
import { MessageError } from "@shared/messaging";

const READY_POLL_MS = 150;
const READY_TIMEOUT_MS = 5000;
const PING_ATTEMPTS_AFTER_INJECT = 6;
const PING_ATTEMPT_DELAY_MS = 150;

export async function waitForTabReady(
  tabId: number,
  timeoutMs: number = READY_TIMEOUT_MS,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.status === "complete") return;
    } catch {
      return; // tab gone — let caller fail naturally
    }
    await new Promise((r) => setTimeout(r, READY_POLL_MS));
  }
}

async function pingOnce(tabId: number, tag: string): Promise<void> {
  await chrome.tabs.sendMessage(tabId, {
    kind: MessageKind.Ping,
    requestId: `${tag}_${Date.now()}`,
    payload: { sentAtMs: Date.now() },
  });
}

async function pingUntilReachable(
  tabId: number,
  attempts: number,
  delayMs: number,
): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      await pingOnce(tabId, `ping_${i}`);
      return;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr ?? new Error("content script unreachable after injection");
}

async function injectContentScript(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ["content.js"],
  });
  await pingUntilReachable(tabId, PING_ATTEMPTS_AFTER_INJECT, PING_ATTEMPT_DELAY_MS);
}

/**
 * Ensure the content script is alive in the target tab. The manifest
 * `content_scripts` entry only injects on navigation — tabs already open
 * before the extension was installed/reloaded won't have it. We ping; if
 * that fails, we programmatically inject `content.js` and retry once.
 * Throws E_NOT_AVAILABLE_HERE on restricted URLs (chrome://, web store, …).
 */
export async function ensureContentScript(tabId: number): Promise<void> {
  await waitForTabReady(tabId);
  try {
    await pingOnce(tabId, "ensure");
    return;
  } catch {
    // CS not loaded — try to inject.
  }
  try {
    await injectContentScript(tabId);
  } catch (e) {
    throw new MessageError(
      ErrorCode.E_NOT_AVAILABLE_HERE,
      "This page can't be exported. Open a regular http(s):// site and try again.",
      e instanceof Error ? e.message : String(e),
    );
  }
}

export async function ensureAllFrameContentScripts(tabId: number): Promise<void> {
  await waitForTabReady(tabId);
  try {
    await injectContentScript(tabId);
  } catch (e) {
    throw new MessageError(
      ErrorCode.E_NOT_AVAILABLE_HERE,
      "This page can't be exported. Open a regular http(s):// site and try again.",
      e instanceof Error ? e.message : String(e),
    );
  }
}
