/**
 * P4 — Computed-style diff vs default. Source: spec/21-app/05-element-export.md.
 *
 * Spawns a short-lived hidden iframe, creates a same-tag element to read the
 * UA defaults, and compares each property against the live target's computed
 * style. Returns the diff as `Record<prop, value>`.
 */
export interface ComputedDiffOptions { include: boolean }

export function computedDiff(target: Element, opts: ComputedDiffOptions): Record<string, string> {
  if (!opts.include) return {};
  if (!document.body) return {};

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:absolute;left:-99999px;top:0;width:0;height:0;border:0";
  document.body.appendChild(iframe);
  try {
    const idoc = iframe.contentDocument;
    if (!idoc?.body) return {};
    const sample = idoc.createElement(target.tagName.toLowerCase());
    idoc.body.appendChild(sample);
    const defaults = (iframe.contentWindow ?? window).getComputedStyle(sample);
    const actual = window.getComputedStyle(target);
    const diff: Record<string, string> = {};
    for (let i = 0; i < actual.length; i++) {
      const name = actual[i];
      const av = actual.getPropertyValue(name);
      const dv = defaults.getPropertyValue(name);
      if (av !== dv) diff[name] = av;
    }
    return diff;
  } finally {
    iframe.remove();
  }
}

export function serializeDiff(diff: Record<string, string>): string {
  return Object.entries(diff).map(([k, v]) => `${k}: ${v};`).join("\n");
}
