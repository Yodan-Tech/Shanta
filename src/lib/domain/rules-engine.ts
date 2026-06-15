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
    };
  }

  if (rule.requiresDeclaration) {
    return { ...base, result: RestrictionCheckResult.NEEDS_DECLARATION };
  }

  return base;
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
    return evaluateItem(item, rule, opts.travelerTier);
  });

  return {
    result: worst(evaluations.map((e) => e.result)),
    items: evaluations,
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
