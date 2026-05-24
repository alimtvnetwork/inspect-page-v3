# Launch State (carry-over)

Current shipped (source): Extension **v2.7.9** + WP plugin **v2.6.0**.

## ✅ Done in v2.7.9 source changes
- Theme locked to dark-mint; removed legacy amber/gold/orange presets + migration on load
- Custom accent constrained to cool greens/teals/blues (`AppearanceSection.tsx`)
- Picker bug fix: no-op clicks on non-pickable areas keep picker active + show "Not pickable" hint
- Export tab: all sections expanded by default (Re-download + Export for AI), disabled-ghost state with hint until capture
- CSS polish: `.lpe-btn:hover` mint-tinted off-white contrast, Export header overlap fixed
- Bumped `extension-src/manifest.json` + `extension/package.json` to `2.7.9`
- Updated `src/components/landing/WhatsNew.tsx` + `docs/PROJECT-DOCS.md` §9 to v2.7.9

## ⏳ Pending (manual / external, all non-WP-plugin) for v2.7.9
- Rebuild `public/inspect-page.zip` (run `bash scripts/release.sh` locally — sandbox lacks deps) and refresh `.sha256` + `.srchash`
- CWS screenshots (1280×800) → `store-assets/screenshots-v2.7.9/`
- Upload `public/inspect-page.zip` to Chrome Web Store dashboard
- Git tag `ext-v2.7.9` (requires new GitHub PAT with `workflow` scope — prior one was leaked and must be revoked)

## 🚫 Blocked — deferred by user (DO NOT surface in remaining-tasks lists)
- All WP plugin tasks (prod `INSPECT_PAGE_WP_SITE_URL`, Stripe live keys/price/webhook, WP-side launch items, `wp-v2.6.0` tag). User said "in future i tink apout wp plugin for now you can skip it" and re-confirmed: omit WP items entirely from `next`/remaining-tasks output — do not even list them as deferred.

## Launch scripts on disk (idempotent)
`verify-prod-build.sh`, `smoke-runbook.sh`, `seed-staging.sh`, `capture-cws-screenshots.sh`, `rollback.sh`, `launch-orchestrator.sh` (resumable 11-step, `--status`/`--reset`/`--only`), `post-launch-watch.sh` (24h monitor, `--once`).
