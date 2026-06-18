import { describe, it, expect } from "vitest";
import { RestrictionDirection, RestrictionCheckResult } from "@prisma/client";
import {
  evaluateShipment,
  summarizeCaps,
  assessManifestDiversity,
} from "./rules-engine";
import type { RuleInput } from "./types";

const FROM = new Date("2026-01-01");

function rule(p: Partial<RuleInput> & { id: string; itemCategory: string }): RuleInput {
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
    direction: RestrictionDirection.BOTH,
    effectiveFrom: FROM,
    effectiveUntil: null,
    ...p,
  };
}

const D = RestrictionDirection;

const LAPTOP_ENTRY = rule({
  id: "laptop",
  itemCategory: "LAPTOP",
  corridorCode: "DUBAI_ET",
  maxUnitsPerTraveler: 1,
  dutyApplies: true,
  dutyNote: "2nd laptop may be taxed.",
  direction: D.ENTRY,
});

describe("per-person unit cap (aggregate)", () => {
  it("passes one laptop into ET", () => {
    const r = evaluateShipment(
      [{ category: "LAPTOP", weightKg: 2, units: 1 }],
      [LAPTOP_ENTRY],
      { corridorCode: "DUBAI_ET", direction: D.ENTRY },
    );
    expect(r.result).toBe(RestrictionCheckResult.PASS);
  });

  it("fails a single line declaring two laptops", () => {
    const r = evaluateShipment(
      [{ category: "LAPTOP", weightKg: 4, units: 2 }],
      [LAPTOP_ENTRY],
      { corridorCode: "DUBAI_ET", direction: D.ENTRY },
    );
    expect(r.result).toBe(RestrictionCheckResult.FAIL);
    expect(r.items[0]?.limitAppliedUnits).toBe(1);
  });

  it("fails two separate 1-unit laptop lines (aggregate exceeds cap)", () => {
    const r = evaluateShipment(
      [
        { category: "LAPTOP", weightKg: 2, units: 1 },
        { category: "LAPTOP", weightKg: 2, units: 1 },
      ],
      [LAPTOP_ENTRY],
      { corridorCode: "DUBAI_ET", direction: D.ENTRY },
    );
    expect(r.result).toBe(RestrictionCheckResult.FAIL);
  });

  it("does not apply the ENTRY laptop cap on a domestic route", () => {
    const r = evaluateShipment(
      [{ category: "LAPTOP", weightKg: 4, units: 2 }],
      [LAPTOP_ENTRY],
      { corridorCode: null, direction: D.BOTH },
    );
    expect(r.result).toBe(RestrictionCheckResult.PASS); // no rule resolves → no cap
  });
});

describe("duty transparency surfacing", () => {
  it("attaches duty info on a passing declarable item", () => {
    const r = evaluateShipment(
      [{ category: "LAPTOP", weightKg: 2, units: 1 }],
      [LAPTOP_ENTRY],
      { corridorCode: "DUBAI_ET", direction: D.ENTRY },
    );
    expect(r.items[0]?.dutyApplies).toBe(true);
    expect(r.items[0]?.dutyNote).toContain("taxed");
  });
});

describe("summarizeCaps", () => {
  it("summarises the per-category caps for a route", () => {
    const caps = summarizeCaps([LAPTOP_ENTRY], {
      corridorCode: "DUBAI_ET",
      direction: D.ENTRY,
    });
    expect(caps).toHaveLength(1);
    expect(caps[0]).toMatchObject({
      category: "LAPTOP",
      maxUnitsPerTraveler: 1,
      dutyApplies: true,
    });
  });
});

describe("assessManifestDiversity (carrier protection)", () => {
  it("flags an over-concentrated, commercial-looking bag", () => {
    const d = assessManifestDiversity(
      [
        { category: "LAPTOP", weightKg: 9 },
        { category: "CLOTHING", weightKg: 1 },
      ],
      { maxConcentration: 0.6, minWeightToAssessKg: 3 },
    );
    expect(d.looksCommercial).toBe(true);
    expect(d.dominantCategory).toBe("LAPTOP");
    expect(d.concentration).toBeCloseTo(0.9);
  });

  it("does not flag a diverse, personal-looking bag", () => {
    const d = assessManifestDiversity(
      [
        { category: "COSMETICS", weightKg: 2 },
        { category: "CLOTHING", weightKg: 3 },
        { category: "BABY_PRODUCTS", weightKg: 4 },
      ],
      { maxConcentration: 0.6, minWeightToAssessKg: 3 },
    );
    expect(d.looksCommercial).toBe(false);
  });

  it("ignores tiny bags below the assess threshold", () => {
    const d = assessManifestDiversity([{ category: "LAPTOP", weightKg: 1 }], {
      maxConcentration: 0.6,
      minWeightToAssessKg: 3,
    });
    expect(d.looksCommercial).toBe(false);
  });
});
