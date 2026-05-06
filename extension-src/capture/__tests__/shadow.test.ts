/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { serializeWithShadow } from "../shadowSerializer";

describe("smoke", () => {
  it("works", () => {
    const d = document.createElement("div");
    d.textContent = "hi";
    expect(serializeWithShadow(d)).toBe("<div>hi</div>");
  });
});
