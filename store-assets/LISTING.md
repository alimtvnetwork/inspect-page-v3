# PagePort — Chrome Web Store listing

All character counts respect Chrome Web Store limits as of 2025.

## Item name (≤ 75 chars)

    PagePort — HTML, CSS, JS & full-page screenshot

(53 chars)

## Summary / short description (≤ 132 chars)

    Export any web page (or one element) as HTML, CSS, JavaScript and a
    full-page screenshot. One ZIP, ready for your LLM.

(127 chars)

## Category

    Developer Tools

## Language

    English (United States)

## Detailed description (≤ 16,000 chars; uses plain text, line breaks OK)

    Stop pasting screenshots into your LLM and hoping for the best.

    PagePort captures any web page exactly as you see it — HTML,
    every readable stylesheet, every readable script, and a full-page
    screenshot — and bundles them into a single ZIP your model can
    actually work with.

    Two modes:

    • Full Page — Click once. Get page.html, styles.css, scripts.js,
      screenshot.png and manifest.json. Sticky headers are hidden during
      capture so they don't ghost across the screenshot.

    • Pick Element — Right-click the part you care about. Get a single
      .md file containing the element's outerHTML, only the CSS rules
      that match it, the computed-style diff vs. browser defaults, and
      two embedded screenshots (in-context and isolated).

    Designed for prompts like:
      "Restyle this section in a Stripe-like way."
      "Rebuild this dashboard in shadcn/ui."
      "Explain why this layout breaks at 768px."

    Why it's different:

    • Runs entirely in your browser. No servers, no telemetry, no
      account.
    • No network calls beyond fetching the page you're already on.
    • Password fields are redacted by default.
    • Open shortcuts: Alt+Shift+E to export the full page,
      Alt+Shift+P to enter the element picker.
    • Floating panel mounts inside a Shadow DOM so it never collides
      with the host page's CSS.
    • Honors prefers-reduced-motion.

    New in 2.2 — Smart Share (optional):

    • Install the companion WordPress plugin, sign in once with your
      normal WP login (no app passwords, no pasted tokens), and any
      export becomes four short shareable URLs — index.html, style.css,
      script.js and preview.png — valid for 24 hours and revocable at
      any time from the panel.

    Known limitations:

    • Cross-origin iframes are kept verbatim (their pixels are still in
      the screenshot, but their DOM is not walked).
    • Closed shadow roots cannot be read by any extension; we surface
      a one-time warning.
    • Pages exceeding the browser canvas limit (16,384 × 32,767) fail
      with a clear E_PAGE_TOO_LARGE error — try Element export instead.

    Permissions, in plain English:

    • activeTab + scripting — read the page you click "Export" on.
    • tabs — find which tab is active for the keyboard shortcut.
    • downloads — save the ZIP / .md to your Downloads folder.
    • storage — remember your settings and panel position.
    • offscreen — assemble the full-page screenshot off-screen.
    • host_permissions <all_urls> — required to export from any page;
      we never read pages you haven't explicitly exported.

    Open source. Issue tracker and changelog at:
    https://github.com/<your-org>/pageport

## Single-purpose statement (required at submission)

    The single purpose of this extension is to export the current web
    page (or one user-selected element from it) as a downloadable bundle
    of HTML, CSS, JavaScript and a full-page screenshot, intended as
    input for large language models.

## Permission justifications (one sentence each)

    activeTab:        Required to read the DOM, stylesheets and scripts
                      of the tab the user explicitly clicks Export on.
    scripting:        Required to inject the floating panel and the
                      element-picker overlay into the active tab on
                      user action.
    tabs:             Required to resolve the active tab for the
                      Alt+Shift+E / Alt+Shift+P keyboard shortcuts.
    downloads:        Required to save the resulting .zip or .md file
                      to the user's Downloads folder.
    storage:          Required to persist user settings (image format,
                      naming template, panel position) across sessions.
    offscreen:        Required to host an OffscreenCanvas that stitches
                      multiple captureVisibleTab frames into one
                      full-page PNG.
    host_permissions: Required because the user must be able to export
                      from any website they visit; the extension only
                      ever reads the tab the user explicitly exports.

## Privacy practices form (data collection)

    Personally identifiable information: NOT collected
    Health information:                  NOT collected
    Financial / payment information:     NOT collected
    Authentication information:          NOT collected
    Personal communications:             NOT collected
    Location:                            NOT collected
    Web history:                         NOT collected
    User activity:                       NOT collected
    Website content:                     NOT transmitted

    Certifications:
      [x] I do not sell or transfer user data to third parties for
          purposes unrelated to the item's single purpose.
      [x] I do not use or transfer user data for purposes unrelated to
          the item's single purpose.
      [x] I do not use or transfer user data to determine
          creditworthiness or for lending purposes.

## Privacy policy URL

    https://<your-domain>/privacy

## Support / homepage URL

    https://<your-domain>/

## Required assets

    Store icon:        128 × 128 PNG          → extension-src/icons/128.png
    Small promo tile:  440 × 280 PNG          → store-assets/promo-440.png
    Marquee (opt.):    1400 × 560 PNG         → store-assets/promo-1400.png
    Screenshots:       1280 × 800 PNG ×5      → store-assets/screen-1.png …

## Versioning & upload

    1. Bump `version` in extension-src/manifest.json AND
       extension/package.json (must match).
    2. cd extension && bun run lint && bun run test && bun run build
       && bun run package
    3. Re-zip without the parent folder (the existing ZIP is already
       laid out correctly: manifest.json must be at the ZIP root).
    4. Upload public/pageport.zip to:
       https://chrome.google.com/webstore/devconsole
    5. Fill the listing using this file. Submit for review.

## Post-submission watchlist

    • Manifest V3 service-worker idle eviction — already mitigated via
      chrome.alarms keep-alive (KEEPALIVE_INTERVAL_MS).
    • host_permissions <all_urls> triggers an in-depth review; expect
      3–10 business days.