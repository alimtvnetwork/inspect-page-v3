# Extension Bug Fixes — Root Cause Analysis & Plan

You reported 4 problems. Here's what each one actually is, and the fix order.

---

## Bug 1 — `Error: URL.createObjectURL is not a function (E_PERMISSION_DENIED)` on Export Full Page

**Root cause.** In Chrome MV3, the Service Worker global **does not expose `URL.createObjectURL`** (it was removed). `background.ts` line 322 calls it directly to hand a Blob to `chrome.downloads.download`. That throws immediately, surfaces as `E_PERMISSION_DENIED`, and breaks every full-page export.

**Fix.** Convert the ZIP Blob to a `data:` URL inside the SW (FileReader/`blob.arrayBuffer()` + base64). `chrome.downloads.download` accepts data URLs. Remove the `URL.revokeObjectURL` machinery for that path.

---

## Bug 2 — "Pick Element" does nothing

**Root cause.** `EnterPickerMode` reaches the content script, but the picker overlay needs the CS to be loaded **and** listening. Two things conspire:
- After the recent messaging refactor, the in-page CS router also returns `false` for unknown messages, but the picker handler is registered on `document` (not the runtime router) — so `EnterPickerMode` arrives, the SW returns `ok`, but no overlay is mounted because `picker.ts` was never initialized in already-open tabs (same root cause as the earlier ensureContentScript bug, but for the picker module which is bundled separately into the floating panel chunk, not `content.js`).
- Also, `ExitPickerMode` from the floating panel sends `tabId: -1` and the SW's `if (tid === undefined) return;` silently drops it on no-sender — picker stays stuck.

**Fix.**
1. In `content.ts`, ensure the picker module is imported eagerly (not lazy) so `EnterPickerMode` always has a handler.
2. Make sure `picker.ts` registers its handler on the shared MessageRouter, not just `document`.
3. Verify with a console log on `EnterPickerMode` receipt.

---

## Bug 3 — "Open panel on page" does nothing / panel buttons inert

**Root cause.** `mountFloatingPanel.tsx` mounts `<ExportPanel surface="floating">` without `activeUrl`. `ExportPanel` then calls `isDisabledUrl(undefined)` → `false` (good), but when buttons fire, `runAction` sends `tabId: -1` to the SW. The SW resolves it from `sender.tab?.id` — that works for full-page export, **but** `chrome.tabs.captureVisibleTab` in `screenshotOrchestrator` needs `windowId`, which we fetch via `chrome.tabs.get(tabId)` — fine. The actual breakage: when invoked from the floating panel, the SW path eventually hits Bug 1 (`URL.createObjectURL`) and dies with the same `E_PERMISSION_DENIED`. Fixing Bug 1 unblocks this.

Separately, "Open panel on page" itself works (panel mounts), but you said it "doesn't work properly" — likely meaning the buttons inside the mounted panel don't do anything. That is Bug 1 again.

**Fix.** No standalone change needed beyond Bug 1 + Bug 2. Verify after.

---

## Bug 4 — "Idle" label is confusing

**Root cause.** UX wording. The status row literally renders the enum name `Idle` from `COPY.statusIdle`. Users don't know what it means.

**Fix.** Change `COPY.statusIdle` from `"Idle"` to something self-explanatory like `"Ready — choose an action above"`. Also tighten the visual: render the status block only when there's something useful to say (busy / error / success), and otherwise show a quiet hint.

---

## Order of execution (one at a time, on your "next")

1. **Bug 1** — replace `URL.createObjectURL` with data-URL conversion in `background.ts`. Rebuild + repackage ZIP.
2. **Bug 2** — wire picker handler properly in `content.ts` / `picker.ts`. Rebuild + repackage.
3. **Bug 4** — reword `COPY.statusIdle` and tweak the status block. (Pure UI.)
4. **Bug 3** — verify it now works end-to-end after 1+2; only edit if a separate issue remains.

Each step ships: edit → build → repackage `public/llm-export.zip` + sha256.

Say **next** to start with Bug 1.
