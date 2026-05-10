=== PagePort ===
Contributors: pageport
Tags: ai, share, export
Requires at least: 5.6
Tested up to: 6.5
Requires PHP: 7.4
Stable tag: 0.1.0
License: MIT

Backend for the PagePort Chrome extension. Hosts captured HTML / CSS / image bundles for 24 hours behind signed public URLs so an LLM can read them.

== Description ==
Install, then in Users → Profile create a new Application Password named `PagePort`. Paste the username + app password into PagePort extension Settings → Share Links. The "Share Links" export mode will then upload your captured assets to your own site and copy three public URLs + an AI instruction block to the clipboard.

== Changelog ==
= 0.1.0 =
* V4 scaffold: tables, REST routes (501 stubs), hourly cron registration.