import type { PricingInput, PricingRule, PriceBreakdown } from "./types";

/**
 * Pricing — implements the fee split from docs/DATA_MODEL.md (CorridorPricing) and
 * the supplementary formula:
 *
 *   carrier   = max(weight × rate, minCharge)
 *   aggregator= flat fee
 *   platform  = commissionRate × (carrier + aggregator)
 *   insurance = insuranceRate × declaredValue   (only if opted in)
 *   tax       = taxRate × subtotal               (0 in Phase 1 — OQ-7)
 *   total     = carrier + aggregator + platform + insurance + tax
 *
 * All math is done in integer cents so the breakdown sums exactly to the total
 * (no floating-point drift). Pricing is configurable per corridor (OQ-2).
 */

const toCents = (etb: number): number => Math.round(etb * 100);
const toEtb = (cents: number): number => cents / 100;

export function computePrice(
  input: PricingInput,
  rule: PricingRule,
): PriceBreakdown {
  if (input.weightKg <= 0) {
    throw new Error("weightKg must be greater than 0");
  }

  const carrierBaseCents = Math.round(input.weightKg * rule.ratePerKgEtb * 100);
  const carrierCents = Math.max(carrierBaseCents, toCents(rule.minChargeEtb));
  const aggregatorCents = toCents(rule.aggregatorFlatFeeEtb);

  const platformCents = Math.round(
    (carrierCents + aggregatorCents) * rule.platformCommissionRate,
  );

  const insuranceCents =
    input.insuranceOptedIn && input.declaredValueEtb
      ? Math.round(toCents(input.declaredValueEtb) * rule.insuranceRate)
      : 0;

  const subtotalCents =
    carrierCents + aggregatorCents + platformCents + insuranceCents;
  const taxCents = Math.round(subtotalCents * rule.taxRate);
  const totalCents = subtotalCents + taxCents;

  return {
    carrierFeeEtb: toEtb(carrierCents),
    aggregatorFeeEtb: toEtb(aggregatorCents),
    platformFeeEtb: toEtb(platformCents),
    insurancePremiumEtb: toEtb(insuranceCents),
    taxAmountEtb: toEtb(taxCents),
    totalPriceEtb: toEtb(totalCents),
    currency: "ETB",
  };
}
