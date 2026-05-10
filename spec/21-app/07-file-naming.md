# 07 — File Naming

## Pattern
Default tokens, joined with `-`, lowercased, ASCII-sanitized:

- Full page: `pageport-fullpage-{domain}-{timestamp}.zip`
- Element:   `pageport-element-{domain}-{tag}-{timestamp}.md`

## Tokens
- `{domain}` — `location.hostname` with `www.` stripped, dots → `_`.
- `{tag}` — element `tagName.toLowerCase()`.
- `{timestamp}` — `YYYYMMDD-HHmmss` in local time.
- `{title}` — optional, `document.title` slugified, max 40 chars.

## Sanitization
Replace `[^a-z0-9._-]` with `-`. Collapse runs of `-`. Trim to 120 chars before extension.

## User override
Settings panel exposes a single string template field; tokens in `{braces}` are substituted.
