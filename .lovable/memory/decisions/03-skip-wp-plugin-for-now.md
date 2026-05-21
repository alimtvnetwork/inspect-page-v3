# Decision: defer WP plugin work

User message (verbatim): *"in future i tink apout wp plugin for now you can skip it"*.

**Applies to all of:**
- Prod `INSPECT_PAGE_WP_SITE_URL` configuration
- Stripe live keys / price / webhook setup
- `wp-v2.6.0` git tag
- Any new WP REST endpoints, dashboard changes, or `wp-plugin/inspect-page/` edits

**Still allowed:** repackaging `public/inspect-page-wp.zip` when CI freshness check demands it (no source changes — just `bash scripts/package-wp.sh`).

If the user mentions WP plugin again, re-confirm before touching it.
