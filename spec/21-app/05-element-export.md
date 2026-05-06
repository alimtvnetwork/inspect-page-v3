# 05 — Element Export

## Output
Single Markdown file: `llm-export-element-{domain}-{tag}-{timestamp}.md`

## Markdown structure
```
# Element export — {tag}#{id}.{classes}

## Source
- URL: {page url}
- Captured: {iso timestamp}
- Selector path: {css path from <html>}

## outerHTML
\`\`\`html
{element.outerHTML}
\`\`\`

## Matched CSS rules
\`\`\`css
{matched rules in source order, with /* from: <stylesheet href> */ headers}
\`\`\`

## Computed styles
\`\`\`css
{property: value; pairs from getComputedStyle, filtered to non-default values}
\`\`\`

## Screenshot — in page context
![context](data:image/png;base64,...)

## Screenshot — isolated
![isolated](data:image/png;base64,...)
```

## Matched-rules collection
Walk `document.styleSheets`. For each `CSSStyleRule`, test `element.matches(rule.selectorText)`. Cross-origin sheets that throw fall back to refetched text + selector match via a temporary parsed sheet.

## Computed styles filtering
Compare each property against a fresh `<div>` of the same tag inserted into a hidden iframe; emit only differing values to keep the file readable.

## In-page screenshot
Capture viewport, then crop to `getBoundingClientRect()` × DPR on the offscreen canvas.

## Isolated screenshot
1. Clone element into an offscreen iframe with the collected matched CSS.
2. Set iframe body background transparent.
3. Use `html-to-image` (chosen over `html2canvas` for better CSS coverage and smaller bundle) to render to PNG.
