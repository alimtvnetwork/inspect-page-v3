# Deferred / Avoid

Things the user explicitly said to skip. Do not act on these unless the user re-opens them.

- **WP plugin work** — see [decisions/03-skip-wp-plugin-for-now.md](../decisions/03-skip-wp-plugin-for-now.md). **Also do NOT surface any WP-plugin item in "remaining tasks" lists or `next`-command suggestions — omit them entirely, do not even mention them as deferred.**
- **Facebook share** — out of scope (per project core memory).
- **AI-generated palette suggestions** in Color Tokens v2 — user picked deterministic variant math instead.
- **Editing the base color hex** in Color Tokens v2 — only variants and per-selector CSS are editable.
