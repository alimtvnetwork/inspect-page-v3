import { describe, expect, it, vi, afterEach } from "vitest";
import { enterPicker, exitPicker, isPickerActive } from "../picker";

function getHost(): HTMLElement | null {
  return document.getElementById("inspect-page-picker-host");
}
function getChip(): HTMLElement | null {
  const host = getHost();
  return host?.shadowRoot?.querySelector(".lpe-pk-chip") ?? null;
}

afterEach(() => {
  if (isPickerActive()) exitPicker();
});

describe("picker chip (P1/P2)", () => {
  it("mounts a chip group with size + 3 action buttons", () => {
    enterPicker({ onSelect: () => {}, onCancel: () => {} });
    const chip = getChip();
    expect(chip).not.toBeNull();
    const size = chip!.querySelector(".lpe-pk-size");
    const btns = chip!.querySelectorAll<HTMLButtonElement>(".lpe-pk-chip-btn");
    expect(size).not.toBeNull();
    expect(btns.length).toBe(3);
    const labels = Array.from(btns).map((b) => b.getAttribute("aria-label"));
    expect(labels).toEqual(["Select element", "Copy selector", "Cancel picker"]);
  });

  it("Cancel button calls onCancel and tears down the picker", () => {
    const onCancel = vi.fn();
    enterPicker({ onSelect: () => {}, onCancel });
    const chip = getChip()!;
    const cancel = chip.querySelector<HTMLButtonElement>('[data-variant="cancel"]')!;
    cancel.click();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(isPickerActive()).toBe(false);
    expect(getHost()).toBeNull();
  });

  it("chip has pointer-events auto so it stays clickable over the page", () => {
    enterPicker({ onSelect: () => {}, onCancel: () => {} });
    const chip = getChip()!;
    // The host stylesheet is parsed in the shadow root; verify the rule survives.
    const styleEl = getHost()!.shadowRoot!.querySelector("style")!;
    expect(styleEl.textContent ?? "").toContain("pointer-events: auto");
  });
});