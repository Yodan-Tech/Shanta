import { describe, it, expect } from "vitest";
import type { PricingRule } from "./types";
import { computePrice } from "./pricing";

// Mirrors the seeded CorridorPricing (Addis → Hawassa), tax 0 (OQ-7).
const PRICING: PricingRule = {
  ratePerKgEtb: 120,
  minChargeEtb: 200,
  aggregatorFlatFeeEtb: 50,
  platformCommissionRate: 0.15,
  insuranceRate: 0.02,
  taxRate: 0,
};

function sumOfParts(b: ReturnType<typeof computePrice>): number {
  return Number(
    (
      b.carrierFeeEtb +
      b.aggregatorFeeEtb +
      b.platformFeeEtb +
      b.insurancePremiumEtb +
      b.taxAmountEtb
    ).toFixed(2),
  );
}

describe("computePrice", () => {
  it("computes the standard breakdown and total equals the sum of parts", () => {
    const b = computePrice({ weightKg: 3, insuranceOptedIn: false }, PRICING);
    // carrier = 3 × 120 = 360 (above 200 min); aggregator = 50;
    // platform = 0.15 × (360+50) = 61.5; total = 471.5
    expect(b.carrierFeeEtb).toBe(360);
    expect(b.aggregatorFeeEtb).toBe(50);
    expect(b.platformFeeEtb).toBe(61.5);
    expect(b.insurancePremiumEtb).toBe(0);
    expect(b.totalPriceEtb).toBe(471.5);
    expect(sumOfParts(b)).toBe(b.totalPriceEtb);
  });

  it("applies the minimum charge floor for tiny shipments", () => {
    // 0.5 × 120 = 60, floored to 200
    const b = computePrice({ weightKg: 0.5, insuranceOptedIn: false }, PRICING);
    expect(b.carrierFeeEtb).toBe(200);
    // platform = 0.15 × (200+50) = 37.5
    expect(b.platformFeeEtb).toBe(37.5);
    expect(sumOfParts(b)).toBe(b.totalPriceEtb);
  });

  it("adds insurance only when opted in", () => {
    const without = computePrice(
      { weightKg: 2, declaredValueEtb: 10000, insuranceOptedIn: false },
      PRICING,
    );
    expect(without.insurancePremiumEtb).toBe(0);

    const withIns = computePrice(
      { weightKg: 2, declaredValueEtb: 10000, insuranceOptedIn: true },
      PRICING,
    );
    expect(withIns.insurancePremiumEtb).toBe(200); // 0.02 × 10000
    expect(sumOfParts(withIns)).toBe(withIns.totalPriceEtb);
  });

  it("applies VAT when a tax rate is set (OQ-7)", () => {
    const b = computePrice(
      { weightKg: 3, insuranceOptedIn: false },
      { ...PRICING, taxRate: 0.15 },
    );
    // subtotal = 471.5; tax = 70.725 → 70.73 (rounded cents); total = 542.23
    expect(b.taxAmountEtb).toBeCloseTo(70.73, 2);
    expect(sumOfParts(b)).toBe(b.totalPriceEtb);
  });

  it("rejects non-positive weight", () => {
    expect(() =>
      computePrice({ weightKg: 0, insuranceOptedIn: false }, PRICING),
    ).toThrow();
  });
});
