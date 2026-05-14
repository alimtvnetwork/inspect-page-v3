import { describe, expect, it, beforeEach } from "vitest";
import { findColorMatches, locateColor } from "../locateColor";

function mount(html: string): void {
  document.body.innerHTML = html;
}

describe("findColorMatches", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("returns elements whose computed background matches the target hex", () => {
    mount(`
      <div id="a" style="background-color: #ff0000"></div>
      <div id="b" style="background-color: rgb(255, 0, 0)"></div>
      <div id="c" style="background-color: #00ff00"></div>
    `);
    const matches = findColorMatches("#ff0000");
    const ids = matches.map((e) => e.id).sort();
    expect(ids).toEqual(["a", "b"]);
  });

  it("matches text color and border color too", () => {
    mount(`
      <p id="t" style="color: #112233">hi</p>
      <p id="bd" style="border: 1px solid #112233">hi</p>
      <p id="other" style="color: #999">hi</p>
    `);
    const ids = findColorMatches("#112233").map((e) => e.id).sort();
    expect(ids).toEqual(["bd", "t"]);
  });

  it("returns empty for an unmatched target", () => {
    mount(`<div style="background: #fff"></div>`);
    expect(findColorMatches("#abcdef")).toEqual([]);
  });

  it("returns empty for empty/falsy target", () => {
    mount(`<div style="background: #fff"></div>`);
    expect(findColorMatches("")).toEqual([]);
  });

  it("locateColor returns the count and is side-effect safe with no matches", () => {
    mount(`<div style="background: #fff"></div>`);
    expect(locateColor("#000000")).toEqual({ count: 0 });
  });

  it("locateColor adds the ring class to matches and removes it after the timeout", async () => {
    mount(`<div id="x" style="background: #abc"></div>`);
    const res = locateColor("#aabbcc");
    expect(res.count).toBe(1);
    const el = document.getElementById("x")!;
    expect(el.classList.contains("lpe-locate-ring")).toBe(true);
    await new Promise((r) => setTimeout(r, 1700));
    expect(el.classList.contains("lpe-locate-ring")).toBe(false);
  });
});
