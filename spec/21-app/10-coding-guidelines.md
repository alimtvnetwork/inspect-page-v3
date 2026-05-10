# 10 — Coding guidelines (enforced)

Mirrors `.lovable/coding-guidelines.md` and adds examples. Apply to every file in `extension-src/`.

## R1. Function size — body ≤ 8 lines

WRONG
```ts
function exportFullPage(tabId: number, settings: Settings) {
  const html = collectHtml();
  const css = collectCss();
  const js = collectJs();
  const meta = buildMeta();
  const png = stitchScreenshot();
  const zip = buildZip(html, css, js, png, meta);
  const url = URL.createObjectURL(zip);
  const filename = makeFilename('fullPage');
  return chrome.downloads.download({ url, filename });
}
```
RIGHT — split into named helpers, each ≤ 8 lines.

## R2. No nested `if`s
WRONG
```ts
if (isReady) {
  if (hasContent) {
    if (isAllowed) { run(); }
  }
}
```
RIGHT — guard clauses (positive form) and early returns.
```ts
function tryRun() {
  if (isNotReady) { return; }
  if (isEmpty) { return; }
  if (isForbidden) { return; }
  run();
}
```

## R3. Positive-condition `if`s
Only invert when the negated form is itself a domain term (`isInvalid`, `isEmpty`, `isForbidden`). Otherwise flip branches so the `if` reads positively.

## R4. Boolean naming
WRONG: `loading`, `done`, `panelMounted`.
RIGHT: `isLoading`, `isDone`, `hasPanelMounted`.

## R5. No `any` / `unknown` (except in generic constraints)
WRONG: `function send(msg: any) {}`
RIGHT: `function send<K extends MessageKind>(msg: Envelope<K>) {}`

## R6. Cross-context messages: discriminated union + `MessageKind` enum.
See `15-message-contracts.md`. Never key on a string literal at the call site.

## R7. File size ≤ 100 lines, one concept per file.
If a file grows, split by concept (not by random line cut).

## R8. No magic numbers / strings in logic
WRONG: `await sleep(600);`
RIGHT: `await sleep(CAPTURE_GAP_MS);` — declared in `shared/constants.ts`, listed in `20-performance-budgets.md`.

WRONG: `if (status === 'idle')`
RIGHT: `if (status === PanelStatus.Idle)`.

## R9. Errors are never swallowed
See `09-error-handling.md` for the never-swallow rule with examples.

## R10. DRY
Shared helpers in `shared/`. Popup and panel reuse the same `<ExportPanel>`. Do not copy code paths.

## R11. React component size ≤ 80 lines
Split when crossing. Extract hooks for reusable behavior (`usePicker`, `useCapture`, `useSettings`).

## R12. No `setTimeout`/`setInterval` for keep-alive
Use `chrome.alarms` (see `19-edge-cases.md` E20).

## R13. No `window.confirm`, `alert`, `prompt`
Use the panel's status row + Copy details.

## R14. No console logging directly
Always `logger.{level}(category, code, message, error?)`. Logger handles prefix (`[pageport]`).

## R15. No I/O in module top-level
Side-effects only inside functions invoked by event handlers, message handlers, or `chrome.runtime.onInstalled`.

## R16. No third-party UI kits
We use Tailwind + the host project's design tokens. No MUI, Chakra, Bootstrap. Shadcn primitives in the host project may be reused inside the popup ONLY if bundled standalone (no runtime cross-extension dep).

## R17. Imports
Absolute aliases via Vite (`@shared/*`, `@panel/*`). No `../../../`.

## R18. Naming map
- Files: kebab-case.
- React components and types: PascalCase.
- Variables/functions: camelCase.
- Enums: PascalCase name + PascalCase members.
- Constants: UPPER_SNAKE_CASE.

## R19. No premature abstraction
Build for the cases in `19-edge-cases.md` only. If a case is "DEFERRED to v2", do NOT add scaffolding now.

## R20. Documentation comments
- `/** JSDoc */` only on exported types and functions in `shared/`.
- No comments inside function bodies; if a function needs an explanation comment, it is doing too much (R1).
