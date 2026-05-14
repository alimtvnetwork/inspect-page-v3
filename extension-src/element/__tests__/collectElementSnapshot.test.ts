import { describe, expect, it } from "vitest";
import { collectElementSnapshot } from "../collectElementSnapshot";

describe("collectElementSnapshot", () => {
  it("captures identity + text + box-model from a simple button", async () => {
    document.body.innerHTML = `
      <button id="cta" class="primary relative" role="button"
        style="padding:8px 12px;margin:4px;border:1px solid #333;
               background:#1c1c1c;color:#e7e7e6;font:14px/21px Inter;font-weight:400">
        Hi
      </button>`;
    const el = document.getElementById("cta")!;
    const snap = await collectElementSnapshot(el, {
      includeMatchedRules: false,
      includeComputedStyles: false,
    });
    expect(snap.identity.tag).toBe("button");
    expect(snap.identity.id).toBe("cta");
    expect(snap.identity.classList).toContain("primary");
    expect(snap.identity.label).toBe("Button");
    expect(snap.identity.selectorChip).toBe("button.primary");
    expect(snap.box.padding.top).toBeGreaterThanOrEqual(0);
    expect(snap.text.fontWeight).toBe(400);
    expect(snap.selection.fg.startsWith("#")).toBe(true);
    expect(snap.selection.bg.startsWith("#")).toBe(true);
    expect(snap.selection.contrast.ratio).toBeGreaterThan(0);
  });
});