=== PagePort ===
Contributors: pageport
Tags: ai, share, export
Requires at least: 5.6
Tested up to: 6.5
Requires PHP: 7.4
Stable tag: 2.2.0
License: MIT

Backend for the PagePort Chrome extension. Hosts captured HTML / CSS / JS / image bundles for 24 hours behind public URLs so an LLM can read them.

== Description ==
Install and activate the plugin, then in the PagePort extension open Settings → Smart Share (WordPress), enter your site URL and click **Sign in**. A WordPress login tab opens; sign in as usual and the extension picks up your cookie + REST nonce automatically — no tokens, no application passwords. The "Smart Share" export mode then uploads your captured HTML / CSS / JS / screenshot to your own site and returns four public URLs (plus an AI instruction block you can paste into ChatGPT, Claude, or Gemini). Each WordPress user is capped at 30 active sessions and 60 uploads per hour; individual share links expire after 24 hours.

== Changelog ==
= 2.2.0 =
* Authentication switched from PagePort pairing tokens to standard WordPress cookie + `X-WP-Nonce` (no shared secrets, no token paste).
* Smart Share now uploads four files (HTML / CSS / **JS** / screenshot) and serves them at `/share/{id}/index.html | style.css | script.js | preview.png`.
* Per-user quotas: 30 active sessions, 60 uploads / hour (`pp_rate_events`).
* `GET /auth-status` returns the signed-in user, fresh nonce, and current quota.
* Hidden `pageport-bridge` admin page used by the extension login popup to forward the `wp_rest` nonce via `postMessage`.

= 2.0.0 =
* PagePort pairing-token auth (`PPT1.<payload>.<hmac>`) replaces WordPress Application Passwords.
* Tools → PagePort admin UI: mint, list, and revoke pairing tokens.
* `POST/GET/DELETE /sessions`, `GET /share/{id}/{html|css|image}`, and `DELETE /pairing/self` REST routes.
* Per-token quota of 30 active sessions; share links expire after 24h.

= 0.1.0 =
* V4 scaffold: tables, REST routes (501 stubs), hourly cron registration.
