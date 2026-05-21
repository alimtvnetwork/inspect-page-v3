# 03 — Root `bun run lint` → 7 ESLint errors

## Symptom
`bun run lint` at repo root reported 7 errors + 19 warnings (warnings unchanged, non-blocking).

## Errors and fixes

| File | Error | Fix |
|------|-------|-----|
| `extension-src/capture/screenshot-orchestrator.ts:147` | `prefer-const` — `canvasW` never reassigned | `let → const` |
| `src/components/landing/Faq.tsx:40` | Definition for rule `react/no-danger` was not found | Removed the `eslint-disable-next-line react/no-danger` comment (rule isn't loaded; comment was orphaned) |
| `src/pages/Index.tsx:62` | Same `react/no-danger` not-found | Removed the orphaned eslint-disable comment |
| `src/components/ui/command.tsx:24` | Empty interface extending supertype | `interface CommandDialogProps extends DialogProps {}` → `type CommandDialogProps = DialogProps;` |
| `src/components/ui/textarea.tsx:5` | Empty interface | `interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}` → `type TextareaProps = ...` |
| `tailwind.config.ts:100` | `no-require-imports` — `require("tailwindcss-animate")` | Added `import tailwindcssAnimate from "tailwindcss-animate"` and used the import in `plugins: [tailwindcssAnimate]` |
| `linters-cicd/checks/_template/fixtures/dirty.ts:9` | `no-debugger` on intentional fixture | Added `linters-cicd/**/fixtures/**` to `ignores` in `eslint.config.js` |

## Verification
```
bun run lint        # exit 0 — 0 errors, 19 pre-existing warnings
```

## Prevention
- New code: don't reintroduce empty interfaces extending one supertype (use `type`).
- Don't add `eslint-disable-next-line react/no-danger` comments unless the rule is actually configured.
- Keep `require()` out of `.ts` config files — use ES imports.
- Never edit fixtures under `linters-cicd/` to satisfy ESLint.

## Status
✅ Resolved.
