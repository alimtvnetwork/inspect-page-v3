import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { logger } from "../../shared/logger";
import { LogCategory } from "../../shared/enums";
import { emitBilling } from "../billingTelemetry";

describe("emitBilling", () => {
  let spy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { spy = vi.spyOn(logger, "info").mockImplementation(() => {}); });
  afterEach(() => { spy.mockRestore(); });

  it("routes to logger.info under the Billing category with surface + props", () => {
    emitBilling("upgrade_clicked", "settings", { freeUsed: 5, freeLimit: 5 });
    expect(spy).toHaveBeenCalledTimes(1);
    const args = spy.mock.calls[0]!;
    expect(args[0]).toBe(LogCategory.Billing);
    expect(args[1]).toBe("UPGRADE_CLICKED");
    expect(args[2]).toBe("billing.upgrade_clicked");
    expect(args[3]).toEqual({ surface: "settings", freeUsed: 5, freeLimit: 5 });
  });

  it("works without props", () => {
    emitBilling("portal_clicked", "settings");
    expect(spy.mock.calls[0]![3]).toEqual({ surface: "settings" });
  });
});