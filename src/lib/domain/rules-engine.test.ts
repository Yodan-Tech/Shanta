import { describe, it, expect } from "vitest";
import {
  RestrictionCheckResult as R,
  RestrictionDirection as D,
  CustomsFrequencyTier as Tier,
} from "@prisma/client";
import type { RuleInput } from "./types";
import {
  resolveRule,
  evaluateItem,
  evaluateShipment,
  checkCrowding,
} from "./rules-engine";

const FROM = new Date("2026-01-01");
const NOW = new Date("2026-06-14");

function rule(partial: Partial<RuleInput> & { id: string; itemCategory: string }): RuleInput {
  return {
    corridorCode: null,
    maxWeightKg: null,
    maxValueEtb: null,
    maxUnitsPerTraveler: null,
    frequencySensitive: false,
    maxWeightKgFrequent: null,
    requiresDeclaration: false,
    requiresSpecialPermit: false,
    prohibited: false,
    dutyApplies: false,
    dutyNote: null,
    direction: D.BOTH,
    effectiveFrom: FROM,
    effectiveUntil: null,
    ...partial,
  };
}

// Fixtures mirroring prisma/seed.ts (Constraint 2.4) + an explicit override pair.
const RULES: RuleInput[] = [
  rule({ id: "coffee", itemCategory: "COFFEE", maxWeightKg: 2, requiresDeclaration: true, requiresSpecialPermit: true, direction: D.EXIT }),
  rule({ id: "spices", itemCategory: "SPICES", maxWeightKg: 5 }),
  rule({ id: "spices_corridor", itemCategory: "SPICES", corridorCode: "TEST_CORRIDOR", maxWeightKg: 1 }),
  rule({ id: "butter", itemCategory: "BUTTER", maxWeightKg: 5 }),
  rule({ id: "jewelry", itemCategory: "JEWELRY", maxWeightKg: 0.1, frequencySensitive: true, maxWeightKgFrequent: 0.05, requiresDeclaration: true }),
  rule({ id: "cash", itemCategory: "CASH", prohibited: true }),
  rule({ id: "electronics", itemCategory: "ELECTRONICS", requiresDeclaration: true }),
  rule({ id: "pharma", itemCategory: "PHARMA", prohibited: true, requiresSpecialPermit: true }),
  rule({ id: "drum", itemCategory: "PLASTIC_DRUM", corridorCode: "ADDIS_INBOUND", prohibited: true, direction: D.ENTRY }),
];

describe("resolveRule", () => {
  it("prefers a corridor-specific rule over the base rule", () => {
    expect(resolveRule("SPICES", "TEST_CORRIDOR", NOW, RULES)?.id).toBe("spices_corridor");
    expect(resolveRule("SPICES", "OTHER", NOW, RULES)?.id).toBe("spices");
    expect(resolveRule("SPICES", null, NOW, RULES)?.id).toBe("spices");
  });

  it("returns null when no rule applies (allowed)", () => {
    expect(resolveRule("CLOTHING", null, NOW, RULES)).toBeNull();
  });

  it("respects the effective-from window", () => {
    const future = [rule({ id: "x", itemCategory: "SPICES", maxWeightKg: 1, effectiveFrom: new Date("2099-01-01") })];
    expect(resolveRule("SPICES", null, NOW, future)).toBeNull();
  });

  it("respects rule direction", () => {
    expect(resolveRule("PLASTIC_DRUM", "ADDIS_INBOUND", NOW, RULES, D.ENTRY)?.id).toBe("drum");
    expect(resolveRule("PLASTIC_DRUM", "ADDIS_INBOUND", NOW, RULES, D.EXIT)).toBeNull();
  });
});

describe("evaluateItem", () => {
  const r = (cat: string, corridor: string | null = null, dir: D = D.BOTH) =>
    resolveRule(cat, corridor, NOW, RULES, dir);

  it("passes a compliant item with no restriction", () => {
    expect(evaluateItem({ category: "CLOTHING", weightKg: 3 }, r("CLOTHING")).result).toBe(R.PASS);
  });

  it("fails an over-limit item", () => {
    expect(evaluateItem({ category: "SPICES", weightKg: 6 }, r("SPICES")).result).toBe(R.FAIL);
    expect(evaluateItem({ category: "SPICES", weightKg: 4 }, r("SPICES")).result).toBe(R.PASS);
  });

  it("always fails prohibited items (cash, pharma)", () => {
    expect(evaluateItem({ category: "CASH", weightKg: 0.1 }, r("CASH")).result).toBe(R.FAIL);
    expect(evaluateItem({ category: "PHARMA", weightKg: 0.1 }, r("PHARMA")).result).toBe(R.FAIL);
  });

  it("applies frequency-sensitive jewelry limits", () => {
    const j = r("JEWELRY");
    // 80g: ok for non-frequent (100g), fails for frequent (50g)
    expect(evaluateItem({ category: "JEWELRY", weightKg: 0.08 }, j, Tier.NON_FREQUENT).result).toBe(R.NEEDS_DECLARATION);
    expect(evaluateItem({ category: "JEWELRY", weightKg: 0.08 }, j, Tier.FREQUENT).result).toBe(R.FAIL);
    // 40g: ok for both
    expect(evaluateItem({ category: "JEWELRY", weightKg: 0.04 }, j, Tier.FREQUENT).result).toBe(R.NEEDS_DECLARATION);
  });

  it("applies the stricter (frequent) limit at submission when tier is unknown", () => {
    const j = r("JEWELRY");
    expect(evaluateItem({ category: "JEWELRY", weightKg: 0.08 }, j, undefined).result).toBe(R.FAIL);
  });

  it("flags permit/declaration needs", () => {
    // coffee within 2kg, no permit → NEEDS_PERMIT
    expect(evaluateItem({ category: "COFFEE", weightKg: 1.5 }, r("COFFEE", null, D.EXIT)).result).toBe(R.NEEDS_PERMIT);
    // coffee with permit → NEEDS_DECLARATION
    expect(evaluateItem({ category: "COFFEE", weightKg: 1.5, hasPermit: true }, r("COFFEE", null, D.EXIT)).result).toBe(R.NEEDS_DECLARATION);
    // coffee over 2kg → FAIL regardless
    expect(evaluateItem({ category: "COFFEE", weightKg: 2.5, hasPermit: true }, r("COFFEE", null, D.EXIT)).result).toBe(R.FAIL);
    expect(evaluateItem({ category: "ELECTRONICS", weightKg: 1 }, r("ELECTRONICS")).result).toBe(R.NEEDS_DECLARATION);
  });
});

describe("evaluateShipment overall precedence", () => {
  it("FAIL dominates", () => {
    const res = evaluateShipment(
      [
        { category: "SPICES", weightKg: 4 },
        { category: "ELECTRONICS", weightKg: 1 },
        { category: "CASH", weightKg: 0.1 },
      ],
      RULES,
      { direction: D.EXIT, onDate: NOW },
    );
    expect(res.result).toBe(R.FAIL);
    expect(res.items).toHaveLength(3);
  });

  it("falls back to the next-worst when no failures", () => {
    const res = evaluateShipment(
      [
        { category: "SPICES", weightKg: 4 },
        { category: "ELECTRONICS", weightKg: 1 },
      ],
      RULES,
      { direction: D.EXIT, onDate: NOW },
    );
    expect(res.result).toBe(R.NEEDS_DECLARATION);
  });

  it("all-clear shipment passes", () => {
    const res = evaluateShipment(
      [{ category: "CLOTHING", weightKg: 2 }],
      RULES,
      { direction: D.EXIT, onDate: NOW },
    );
    expect(res.result).toBe(R.PASS);
  });
});

describe("checkCrowding", () => {
  it("allows within the category limit and blocks over it", () => {
    expect(checkCrowding(4, 1, 5)).toBe(true);
    expect(checkCrowding(4, 2, 5)).toBe(false);
    expect(checkCrowding(0, 5, 5)).toBe(true);
  });
});
