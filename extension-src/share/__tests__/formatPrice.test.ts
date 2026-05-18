import { describe, it, expect } from "vitest";
import { formatBillingPriceTagline } from "../formatPrice";

describe("formatBillingPriceTagline", () => {
  it("falls back when price is missing", () => {
    expect(formatBillingPriceTagline(undefined)).toBe(
      "$5 / month — unlimited Smart Shares",
    );
  });

  it("falls back when unit_amount/currency missing", () => {
    expect(
      formatBillingPriceTagline({
        id: "price_1", unitAmount: null, currency: null,
        interval: "month", nickname: null,
      }),
    ).toBe("$5 / month — unlimited Smart Shares");
  });

  it("formats USD whole-dollar price", () => {
    const out = formatBillingPriceTagline({
      id: "price_1", unitAmount: 500, currency: "USD",
      interval: "month", nickname: null,
    });
    expect(out).toContain("$5");
    expect(out).toContain("month");
    expect(out).toContain("unlimited Smart Shares");
  });

  it("formats EUR yearly with decimals", () => {
    const out = formatBillingPriceTagline({
      id: "price_2", unitAmount: 4999, currency: "EUR",
      interval: "year", nickname: null,
    });
    expect(out).toContain("year");
    expect(out).toMatch(/49\.99|49,99/);
  });

  it("uses provided fallback override", () => {
    expect(formatBillingPriceTagline(undefined, "Custom")).toBe("Custom");
  });
});