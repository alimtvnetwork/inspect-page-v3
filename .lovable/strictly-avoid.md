# Strictly Avoid

Hard rules. Violating any of these breaks the project.

- **Brand tokens:** never use `PagePort`, `LLM Export`, `LLM Page Export`, or `llm-export` in UI, code, comments, file names, zips, or docs.
- **Per-version doc files:** never create `docs/RELEASE-NOTES-vX*`, `docs/AC-*`, `docs/PEN-TEST-*`, `docs/LIVE-MODE-RUNBOOK-*`, `docs/PHASE-*`, `docs/QA-CHECKLIST*`, `docs/SCREENSHOT-SHOTLIST*`, `docs/V2.4-PLAN*`, `docs/GITHUB-RELEASE-*`. Append to `docs/PROJECT-DOCS.md` §9 instead.
- **Marketing site (`src/`) scope:** do not edit unless the user explicitly says landing/website/marketing/WhatsNew or names a file there.
- **Popup geometry:** never remove the `.lpe-btn-hero` / `.lpe-btn-ico` size guards or the hero SVG intrinsic `18×18` attrs. If popup balloons → History-revert, do not patch CSS further.
- **Extension theme:** never repaint the dark-mint palette without explicit user approval.
- **`.lovable/memories/`:** wrong path. Always `.lovable/memory/`.
- **`showSaveFilePicker` in extension downloads:** blocked inside in-page iframe panel. Always use anchor download or `chrome.downloads` with `saveAs: false`. See: `.lovable/solved-issues/01-export-dropdown-silent.md`.
- **WP plugin work:** deferred per user request — see `.lovable/memory/avoid/01-deferred-scope.md`.
