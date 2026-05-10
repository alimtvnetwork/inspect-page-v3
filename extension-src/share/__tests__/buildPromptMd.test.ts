import { describe, expect, it } from "vitest";
import { buildPromptMd, refsForMode } from "@share/buildPromptMd";
import { ExportFlow } from "@shared/enums";
import type { ExportArtifacts } from "@shared/types";

function fixture(): ExportArtifacts {
  return {
    flow: ExportFlow.FullPage,
    domain: "example.com",
    html: "<html></html>",
    css: "body{}",
    js: "",
    images: [{ name: "screenshot.png", mime: "image/png", base64: "AAAA" }],
    // meta is unused by the helper; cast to satisfy the type.
    meta: {} as ExportArtifacts["meta"],
  };
}

describe("buildPromptMd", () => {
  it("single mode references inline sections", () => {
    const md = buildPromptMd(fixture(), { mode: "single" });
    expect(md).toContain("(see §HTML below)");
    expect(md).toContain("(see §CSS below)");
    expect(md).toContain("(embedded inline)");
    expect(md).toContain("--- USER INSTRUCTION ---");
  });

  it("mdFiles mode uses relative paths", () => {
    const md = buildPromptMd(fixture(), { mode: "mdFiles" });
    expect(md).toContain("./index.html");
    expect(md).toContain("./style.css");
    expect(md).toContain("./images/screenshot.png");
  });

  it("zip mode matches mdFiles refs", () => {
    const a = fixture();
    expect(refsForMode(a, { mode: "zip" })).toEqual(
      refsForMode(a, { mode: "mdFiles" }),
    );
  });

  it("share mode uses provided refs", () => {
    const md = buildPromptMd(fixture(), {
      mode: "share",
      shareRefs: {
        htmlRef: "https://x.test/h",
        cssRef: "https://x.test/c",
        imageRef: "https://x.test/i",
      },
    });
    expect(md).toContain("https://x.test/h");
    expect(md).toContain("https://x.test/c");
    expect(md).toContain("https://x.test/i");
  });

  it("share mode without refs throws", () => {
    expect(() => buildPromptMd(fixture(), { mode: "share" })).toThrow();
  });

  it("mdFiles falls back when no images", () => {
    const a = fixture();
    a.images = [];
    const md = buildPromptMd(a, { mode: "mdFiles" });
    expect(md).toContain("(no image)");
  });
});