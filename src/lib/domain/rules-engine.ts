import {
  RestrictionCheckResult,
  RestrictionDirection,
  CustomsFrequencyTier,
} from "@prisma/client";
import type {
  ItemInput,
  RuleInput,
  ItemEvaluation,
  ShipmentEvaluation,
  EvaluateOptions,
} from "./types";

/**
 * Rules engine — implements docs/RULES_ENGINE.md. Pure: rules are passed in
 * (loaded from ItemRestriction rows by the caller). Resolution order:
 * active corridor-specific rule > active base rule > no restriction.
 */

function isActive(rule: RuleInput, onDate: Date): boolean {
  if (rule.effectiveFrom.getTime() > onDate.getTime()) return false;
  if (rule.effectiveUntil && rule.effectiveUntil.getTime() < onDate.getTime()) {
    return false;
  }
  return true;
}

function appliesToDirection(
  rule: RuleInput,
  direction: RestrictionDirection,
): boolean {
  return (
    rule.direction === RestrictionDirection.BOTH || rule.direction === direction
  );
}

/** Resolve the single governing rule for a category + corridor on a date. */
export function resolveRule(
  category: string,
  corridorCode: string | null | undefined,
  onDate: Date,
  rules: RuleInput[],
  direction: RestrictionDirection = RestrictionDirection.BOTH,
): RuleInput | null {
  const candidates = rules.filter(
    (r) =>
      r.itemCategory === category &&
      isActive(r, onDate) &&
      appliesToDirection(r, direction),
  );
  // Prefer the most specific active rule (corridor match) over the base rule.
  const corridorRule = corridorCode
    ? candidates.find((r) => r.corridorCode === corridorCode)
    : undefined;
  if (corridorRule) return corridorRule;
  return candidates.find((r) => r.corridorCode === null) ?? null;
}

/** The weight limit that applies to an item given the traveler's frequency tier. */
export function limitForTier(
  rule: RuleInput,
  tier: CustomsFrequencyTier | undefined,
): number | null {
  if (!rule.frequencySensitive) return rule.maxWeightKg;
  // Frequency-sensitive: FREQUENT travellers get the stricter cap. At submission
  // (tier unknown) apply the stricter limit so we never over-promise the sender.
  const useFrequent =
    tier === CustomsFrequencyTier.FREQUENT || tier === undefined;
  return useFrequent
    ? (rule.maxWeightKgFrequent ?? rule.maxWeightKg)
    : rule.maxWeightKg;
}

/** Evaluate a single item against its resolved rule. */
export function evaluateItem(
  item: ItemInput,
  rule: RuleInput | null,
  tier?: CustomsFrequencyTier,
): ItemEvaluation {
  const base: ItemEvaluation = {
    itemId: item.id,
    category: item.category,
    result: RestrictionCheckResult.PASS,
  };

  if (!rule) return base;

  if (rule.prohibited) {
    return {
      ...base,
      result: RestrictionCheckResult.FAIL,
      failedRuleId: rule.id,
      reason: `${item.category} is prohibited.`,
    };
  }

  const limit = limitForTier(rule, tier);
  if (limit !== null && item.weightKg > limit) {
    return {
      ...base,
      result: RestrictionCheckResult.FAIL,
      failedRuleId: rule.id,
      limitAppliedKg: limit,
      reason: `Declared ${item.weightKg}kg exceeds ${limit}kg limit for ${item.category}.`,
    };
  }

  if (
    rule.maxValueEtb !== null &&
    item.valueEtb !== undefined &&
    item.valueEtb > rule.maxValueEtb
  ) {
    return {
      ...base,
      result: RestrictionCheckResult.FAIL,
      failedRuleId: rule.id,
      reason: `Declared value exceeds ${rule.maxValueEtb} ETB limit.`,
    };
  }

  if (rule.requiresSpecialPermit && !item.hasPermit) {
    return {
      ...base,
      result: RestrictionCheckResult.NEEDS_PERMIT,
      failedRuleId: rule.id,
      reason: `${item.category} requires a special permit.`,
      ...dutyInfo(rule),
    };
  }

  if (rule.requiresDeclaration) {
    return {
      ...base,
      result: RestrictionCheckResult.NEEDS_DECLARATION,
      ...dutyInfo(rule),
    };
  }

  // Passes — still surface duty transparency (declarable/taxable) when it applies.
  return { ...base, ...dutyInfo(rule) };
}

/** Transparency block: what the traveller should expect at customs (not a failure). */
function dutyInfo(
  rule: RuleInput,
): { dutyApplies?: boolean; dutyNote?: string } {
  if (!rule.dutyApplies) return {};
  return {
    dutyApplies: true,
    ...(rule.dutyNote ? { dutyNote: rule.dutyNote } : {}),
  };
}

// Overall result precedence: FAIL > NEEDS_PERMIT > NEEDS_DECLARATION > PASS.
const PRECEDENCE: RestrictionCheckResult[] = [
  RestrictionCheckResult.FAIL,
  RestrictionCheckResult.NEEDS_PERMIT,
  RestrictionCheckResult.NEEDS_DECLARATION,
  RestrictionCheckResult.PASS,
];

function worst(results: RestrictionCheckResult[]): RestrictionCheckResult {
  for (const r of PRECEDENCE) {
    if (results.includes(r)) return r;
  }
  return RestrictionCheckResult.PASS;
}

/** Evaluate a whole shipment's items against the ruleset. */
export function evaluateShipment(
  items: ItemInput[],
  rules: RuleInput[],
  opts: EvaluateOptions,
): ShipmentEvaluation {
  const onDate = opts.onDate ?? new Date();
  const evaluations = items.map((item) => {
    const rule = resolveRule(
      item.category,
      opts.corridorCode,
      onDate,
      rules,
      opts.direction,
    );
    return { item, rule, evaluation: evaluateItem(item, rule, opts.travelerTier) };
  });

  // Per-person unit cap is an AGGREGATE across the shipment: the lawful personal-use
  // allowance (e.g. 1 laptop/person into ET) applies to the total units of a category,
  // not each line — so two 1-unit lines of the same category still breach a cap of 1.
  const unitsByCategory = new Map<string, number>();
  for (const { item } of evaluations) {
    unitsByCategory.set(
      item.category,
      (unitsByCategory.get(item.category) ?? 0) + (item.units ?? 1),
    );
  }
  for (const entry of evaluations) {
    const { item, rule, evaluation } = entry;
    if (
      rule?.maxUnitsPerTraveler != null &&
      evaluation.result !== RestrictionCheckResult.FAIL
    ) {
      const total = unitsByCategory.get(item.category) ?? 0;
      if (total > rule.maxUnitsPerTraveler) {
        entry.evaluation = {
          ...evaluation,
          result: RestrictionCheckResult.FAIL,
          failedRuleId: rule.id,
          limitAppliedUnits: rule.maxUnitsPerTraveler,
          reason: `${total} ${item.category} exceeds the personal-use allowance of ${rule.maxUnitsPerTraveler} per traveler.`,
        };
      }
    }
  }

  const finalEvaluations = evaluations.map((e) => e.evaluation);
  return {
    result: worst(finalEvaluations.map((e) => e.result)),
    items: finalEvaluations,
  };
}

/**
 * Crowding constraint (docs/RULES_ENGINE.md): a single traveler must not carry
 * more than the category limit across a trip. Returns true if adding `newItemKg`
 * to what's already accepted in that category stays within the limit.
 */
export function checkCrowding(
  alreadyAcceptedKg: number,
  newItemKg: number,
  categoryLimitKg: number,
): boolean {
  return alreadyAcceptedKg + newItemKg <= categoryLimitKg;
}

// ── "What can I pack" summary (bot /pack, admin) ──────────────────────────────

/** A human-facing cap summary for one category on a route/direction. */
export interface CategoryCap {
  category: string;
  prohibited: boolean;
  maxWeightKg: number | null;
  maxUnitsPerTraveler: number | null;
  requiresDeclaration: boolean;
  requiresSpecialPermit: boolean;
  dutyApplies: boolean;
  dutyNote: string | null;
}

/**
 * Summarise the governing rule per category for a route + direction — the data
 * behind "what can I pack". Compliance-positive: it states each traveller's lawful
 * personal-use allowance and what is declarable/taxable; it is not duty-avoidance advice.
 */
export function summarizeCaps(
  rules: RuleInput[],
  opts: { corridorCode?: string | null; direction: RestrictionDirection; onDate?: Date },
): CategoryCap[] {
  const onDate = opts.onDate ?? new Date();
  const categories = [...new Set(rules.map((r) => r.itemCategory))].sort();
  const caps: CategoryCap[] = [];
  for (const category of categories) {
    const rule = resolveRule(category, opts.corridorCode, onDate, rules, opts.direction);
    if (!rule) continue;
    caps.push({
      category,
      prohibited: rule.prohibited,
      maxWeightKg: rule.maxWeightKg,
      maxUnitsPerTraveler: rule.maxUnitsPerTraveler,
      requiresDeclaration: rule.requiresDeclaration,
      requiresSpecialPermit: rule.requiresSpecialPermit,
      dutyApplies: rule.dutyApplies,
      dutyNote: rule.dutyNote,
    });
  }
  return caps;
}

// ── Manifest diversity (carrier protection — Constraint 2.1/2.2) ──────────────

export interface ManifestLine {
  category: string;
  weightKg: number;
}

export interface ManifestDiversity {
  /** Largest share (0–1) any single category occupies of the manifest weight. */
  concentration: number;
  dominantCategory: string | null;
  totalWeightKg: number;
  distinctCategories: number;
  /** True if the bag looks commercial (over-concentrated) and should be flagged. */
  looksCommercial: boolean;
}

/**
 * Assess how "personal" a carrier's full bag looks. A bag dominated by one category
 * reads as a commercial import to a customs officer (Constraint 2.2) and exposes the
 * individual traveller. This PROTECTS the carrier — it flags concentration so the
 * operator can diversify the manifest; it is not a tool to evade duties owed.
 *
 * `maxConcentration` (0–1) and `minDistinctForLarge` come from AppConfig.
 */
export function assessManifestDiversity(
  lines: ManifestLine[],
  opts: { maxConcentration: number; minWeightToAssessKg?: number },
): ManifestDiversity {
  const totalWeightKg = lines.reduce((s, l) => s + l.weightKg, 0);
  const byCategory = new Map<string, number>();
  for (const l of lines) {
    byCategory.set(l.category, (byCategory.get(l.category) ?? 0) + l.weightKg);
  }
  let dominantCategory: string | null = null;
  let dominantKg = 0;
  for (const [cat, kg] of byCategory) {
    if (kg > dominantKg) {
      dominantKg = kg;
      dominantCategory = cat;
    }
  }
  const concentration = totalWeightKg > 0 ? dominantKg / totalWeightKg : 0;
  const minWeight = opts.minWeightToAssessKg ?? 0;
  const looksCommercial =
    totalWeightKg >= minWeight &&
    byCategory.size > 0 &&
    concentration > opts.maxConcentration;

  return {
    concentration,
    dominantCategory,
    totalWeightKg,
    distinctCategories: byCategory.size,
    looksCommercial,
  };
}
