=== PagePort ===
Contributors: pageport
Tags: ai, share, export
Requires at least: 5.6
Tested up to: 6.5
Requires PHP: 7.4
Stable tag: 2.0.0
License: MIT

Backend for the PagePort Chrome extension. Hosts captured HTML / CSS / image bundles for 24 hours behind signed public URLs so an LLM can read them.

== Description ==
Install, then go to Tools → PagePort and click **Mint new pairing token**. Copy the `PPT1.…` token and paste it into the PagePort extension under Settings → Share Links. The site URL is decoded from the token automatically. The "Share Links" export mode will then upload your captured HTML / CSS / screenshot to your own site and copy three public URLs + an AI instruction block to the clipboard. Each pairing token is capped at 30 active sessions and individual share links expire after 24 hours.

== Changelog ==
= 2.0.0 =
* PagePort pairing-token auth (`PPT1.<payload>.<hmac>`) replaces WordPress Application Passwords.
* Tools → PagePort admin UI: mint, list, and revoke pairing tokens.
* `POST/GET/DELETE /sessions`, `GET /share/{id}/{html|css|image}`, and `DELETE /pairing/self` REST routes.
* Per-token quota of 30 active sessions; share links expire after 24h.

= 0.1.0 =
* V4 scaffold: tables, REST routes (501 stubs), hourly cron registration.