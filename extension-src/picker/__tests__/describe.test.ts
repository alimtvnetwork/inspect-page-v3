import { describe as desc, expect, it } from "vitest";
import { describe } from "../picker";

function fakeEl(tag: string, id?: string, classes: string[] = []): Element {
  const cl = {
    length: classes.length,
    [Symbol.iterator]: function* () { yield* classes; },
  };
  return {
    tagName: tag.toUpperCase(),
    id: id ?? "",
    classList: cl,
  } as unknown as Element;
}

desc("describe", () => {
  it("formats tag only", () => {
    expect(describe(fakeEl("div"))).toBe("div");
  });
  it("includes id and up to 3 classes", () => {
    expect(describe(fakeEl("section", "main", ["a", "b", "c", "d"]))).toBe("section#main.a.b.c");
  });
  it("truncates to PICKER_TOOLTIP_MAX_CHARS", () => {
    const longClasses = Array.from({ length: 3 }, (_, i) => `cls${i}-${"x".repeat(40)}`);
    const out = describe(fakeEl("article", "long-id-of-some-length", longClasses));
    expect(out.length).toBeLessThanOrEqual(80);
  });
});
