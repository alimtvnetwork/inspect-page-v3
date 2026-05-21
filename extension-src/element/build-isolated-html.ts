/**
 * P6 step 1 — Build the isolated HTML doc that is rendered offscreen.
 * Source: spec/21-app/05-element-export.md §P6.
 */
export function buildIsolatedHtml(input: { baseHref: string; matchedCss: string; outerHtml: string }): string {
  return [
    "<!DOCTYPE html>",
    `<html><head><meta charset="utf-8"><base href="${escapeAttr(input.baseHref)}">`,
    `<style>${input.matchedCss}</style>`,
    `</head><body style="margin:0;background:transparent">${input.outerHtml}</body></html>`,
  ].join("");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
