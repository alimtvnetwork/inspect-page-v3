import { describe, it, expect } from "vitest";
import { detectProFlip } from "../detect-pro-flip";

describe("detectProFlip (2.6.0 Pro toast guard)", () => {
  it("fires on free -> pro", () => {
    expect(detectProFlip("free", "pro")).toBe(true);
  });

  it("does NOT fire on first observation (prev=null) even if next is pro", () => {
    expect(detectProFlip(null, "pro")).toBe(false);
    expect(detectProFlip(undefined, "pro")).toBe(false);
  });

  it("does NOT fire on pro -> pro (steady state)", () => {
    expect(detectProFlip("pro", "pro")).toBe(false);
  });

  it("does NOT fire on free -> free (steady state)", () => {
    expect(detectProFlip("free", "free")).toBe(false);
  });

  it("does NOT fire on pro -> free (downgrade — no celebration)", () => {
    expect(detectProFlip("pro", "free")).toBe(false);
  });

  it("fires on legacy unknown-string -> pro (treats anything non-pro as pre-pro)", () => {
    expect(detectProFlip("trial", "pro")).toBe(true);
    expect(detectProFlip("comp", "pro")).toBe(true);
  });

  it("does NOT fire when next plan is not exactly 'pro'", () => {
    expect(detectProFlip("free", "trial")).toBe(false);
    expect(detectProFlip("free", null)).toBe(false);
    expect(detectProFlip("free", undefined)).toBe(false);
  });
});