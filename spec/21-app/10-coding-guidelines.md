# 10 — Coding guidelines (enforced)

Mirrors `.lovable/coding-guidelines.md`. Apply to every file.

## Functions
- ≤ 8 lines of body (excluding signature and closing brace).
- No nested `if`s. Extract or use early returns.
- Only positive-condition `if`s. Replace `if (!isReady)` with `if (isNotReady)` only when the negated form is itself a domain concept; otherwise invert the branch.

## Booleans
- Prefix with `is` or `has`.
- No double negatives.

## Types
- Never `any` or `unknown` (except inside generic constraints `<T>`).
- Cross-context messages use discriminated unions keyed by a `MessageKind` enum.

## Files
- ≤ 100 lines per file.
- One concept per file. Types live next to the code that owns them or in a sibling `types.ts`.

## Constants and enums
- No magic strings or numbers in logic. All live in `constants.ts` or as `enum`.

## Errors
- See `09-error-handling.md`. Every `catch` logs.

## DRY
- Shared helpers in `src/shared/`. Popup and panel reuse the same components.

## React
- Components stay small (< 80 lines). Split when they cross.
- Hooks for any reusable behavior (picker, capture, settings).
