# Launch State (carry-over)

Current shipped: Extension **v2.7.7** + WP plugin **v2.6.0**.

## ✅ Done this session
- Export dropdown silent-failure fix (`chrome.downloads` Save As path instead of blocked iframe anchor/file picker paths)
- All `chrome.downloads` calls flipped to `saveAs: false` (no forced Save As… dialog)
- CI/CD lint cleanup — 7 errors → 0 (see `.lovable/cicd-issues/03-...`)
- CI/CD `eslint not found` in `extension/` workspace fixed (script now uses root binary)
- CI/CD zip freshness fixed by repackaging WP plugin

## ⏳ Pending (manual / external, all non-WP-plugin)
- CWS screenshots (1280×800) → `store-assets/screenshots-v2.7.7/`
- Upload `public/inspect-page.zip` to Chrome Web Store dashboard
- Git tag `ext-v2.7.7` (`git tag ext-v2.7.7 && git push origin ext-v2.7.7`)

## 🚫 Blocked — deferred by user
- All WP plugin tasks (prod `INSPECT_PAGE_WP_SITE_URL`, Stripe live keys/price/webhook, WP-side launch items, `wp-v2.6.0` tag). User said "in future i tink apout wp plugin for now you can skip it".

## Launch scripts on disk (idempotent)
`verify-prod-build.sh`, `smoke-runbook.sh`, `seed-staging.sh`, `capture-cws-screenshots.sh`, `rollback.sh`, `launch-orchestrator.sh` (resumable 11-step, `--status`/`--reset`/`--only`), `post-launch-watch.sh` (24h monitor, `--once`).
