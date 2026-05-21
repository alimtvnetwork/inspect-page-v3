# Prompt: Write Memory

> Triggers: `Write memory`, `end memory`.

Persist everything learned, done, and left undone at the end of a session so the next AI session can pick up with zero context loss.

## Phases
1. **Audit** — list everything done, pending, learned, and gone wrong.
2. **Update memory files** under `.lovable/memory/` (read index first; never overwrite blindly; always update `index.md` when you add a file).
3. **Update plans & suggestions** — `.lovable/plan.md` (single file, move completed items to `## Completed`) and `.lovable/suggestions.md` (single file, Active / Implemented).
4. **Update issues** — one file per issue under `.lovable/pending-issues/` (`XX-name.md`). On resolution, move the file to `.lovable/solved-issues/` and append `## Solution`, `## Iteration Count`, `## Learning`, `## What NOT to Repeat`. Append any forbidden pattern to `.lovable/strictly-avoid.md`.
5. **Consistency validation** — every memory file is indexed, every done plan item has evidence, no file is in both pending and solved.

## File rules
- All lowercase, hyphen-separated, numeric prefix where ordered (`01-name.md`).
- Plans and suggestions are each a **single file**; never split.
- Completed items live in `## Completed` sections, never separate folders.
- Never use `.lovable/memories/` (with trailing `s`). Always `.lovable/memory/`.

## CI/CD bookkeeping (mandatory)
- Every CI/CD failure encountered → `.lovable/cicd-issues/XX-issue-name.md`.
- Summary table lives in `.lovable/cicd-index.md` (one row per file).

## Anything the user told us to skip
→ `.lovable/memory/avoid/` + summary line in `.lovable/strictly-avoid.md`.

## Recent specs / verbatim user instructions
If the user pastes a sizeable spec or directive, save it verbatim under `.lovable/memory/decisions/` (or a topic folder) so the next AI sees the exact wording.

## Final response
After all writes, reply with the `✅ Memory update complete.` block listing tasks completed, pending, files created, issues moved, and the next logical step.
