/**
 * Seed: the Constraint 2.4 ruleset (docs/RULES_ENGINE.md), one corridor price, and
 * AppConfig thresholds. All rule `sourceRegulation` values are marked unverified
 * until the official customs document is obtained (OQ-3). Idempotent: clears the
 * seeded tables first, then recreates.
 */
import {
  PrismaClient,
  RestrictionDirection,
} from "@prisma/client";

const prisma = new PrismaClient();

const EFFECTIVE_FROM = new Date("2026-01-01");
const UNVERIFIED = "secondary research, unverified";

async function main() {
  // --- Rules engine (Constraint 2.4) ---
  await prisma.itemRestriction.deleteMany();
  await prisma.itemRestriction.createMany({
    data: [
      {
        itemCategory: "COFFEE",
        maxWeightKg: "2.0",
        requiresDeclaration: true,
        requiresSpecialPermit: true,
        direction: RestrictionDirection.EXIT,
        notes:
          "Coffee max 2kg per passenger on exit; special authorization beyond this.",
        sourceRegulation: UNVERIFIED,
        effectiveFrom: EFFECTIVE_FROM,
      },
      {
        itemCategory: "SPICES",
        maxWeightKg: "5.0",
        direction: RestrictionDirection.BOTH,
        notes: "Spices max 5kg.",
        sourceRegulation: UNVERIFIED,
        effectiveFrom: EFFECTIVE_FROM,
      },
      {
        itemCategory: "BUTTER",
        maxWeightKg: "5.0",
        direction: RestrictionDirection.BOTH,
        notes: "Butter max 5kg.",
        sourceRegulation: UNVERIFIED,
        effectiveFrom: EFFECTIVE_FROM,
      },
      {
        itemCategory: "JEWELRY",
        maxWeightKg: "0.1",
        frequencySensitive: true,
        maxWeightKgFrequent: "0.05",
        requiresDeclaration: true,
        direction: RestrictionDirection.BOTH,
        notes:
          "Jewelry 100g non-frequent traveler; 50g frequent traveler (Constraint 2.1).",
        sourceRegulation: UNVERIFIED,
        effectiveFrom: EFFECTIVE_FROM,
      },
      {
        itemCategory: "CASH",
        prohibited: true,
        direction: RestrictionDirection.BOTH,
        notes:
          "Shanta must NEVER function as a cash-movement mechanism. Hard prohibition.",
        sourceRegulation: "Constraint 2.4 / platform policy",
        effectiveFrom: EFFECTIVE_FROM,
      },
      {
        itemCategory: "ELECTRONICS",
        requiresDeclaration: true,
        direction: RestrictionDirection.BOTH,
        notes: "Laptops/electronics must be declared on entry and exit.",
        sourceRegulation: UNVERIFIED,
        effectiveFrom: EFFECTIVE_FROM,
      },
      {
        itemCategory: "PHARMA",
        prohibited: true,
        requiresSpecialPermit: true,
        direction: RestrictionDirection.BOTH,
        notes:
          "Pharmaceuticals require special permits; EXCLUDED from MVP (prohibited Phase 1).",
        sourceRegulation: UNVERIFIED,
        effectiveFrom: EFFECTIVE_FROM,
      },
      {
        itemCategory: "PLASTIC_DRUM",
        corridorCode: "ADDIS_INBOUND",
        prohibited: true,
        direction: RestrictionDirection.ENTRY,
        notes:
          "Plastic barrels/drums forbidden for personal-effects to Addis (corridor-specific).",
        sourceRegulation: UNVERIFIED,
        effectiveFrom: EFFECTIVE_FROM,
      },
    ],
  });

  // --- One sample corridor price (provisional — OQ-2) ---
  await prisma.corridorPricing.deleteMany();
  await prisma.corridorPricing.create({
    data: {
      originRegion: "Addis Ababa",
      destinationRegion: "Hawassa",
      ratePerKgEtb: "120.00",
      minChargeEtb: "200.00",
      aggregatorFlatFeeEtb: "50.00",
      platformCommissionRate: "0.1500",
      insuranceRate: "0.0200",
      taxRate: "0.0000",
      effectiveFrom: EFFECTIVE_FROM,
    },
  });

  // --- Runtime config thresholds ---
  await prisma.appConfig.upsert({
    where: { key: "frequency.tier_threshold_90d" },
    update: { value: { value: 4 } },
    create: {
      key: "frequency.tier_threshold_90d",
      value: { value: 4 },
      description:
        "90-day trip count at/above which a traveler is FREQUENT (Constraint 2.1).",
    },
  });
  await prisma.appConfig.upsert({
    where: { key: "crowding.max_distinct_senders_per_category" },
    update: { value: { value: 2 } },
    create: {
      key: "crowding.max_distinct_senders_per_category",
      value: { value: 2 },
      description:
        "Max distinct senders of one category matched to a single traveler/trip.",
    },
  });
  await prisma.appConfig.upsert({
    where: { key: "intake.weight_discrepancy_threshold_kg" },
    update: { value: { value: 0.5 } },
    create: {
      key: "intake.weight_discrepancy_threshold_kg",
      value: { value: 0.5 },
      description:
        "Absolute kg gap between declared and actual total weight at hub intake that flags WEIGHT_DISCREPANCY (Constraint 2.4 re-validation).",
    },
  });

  const rules = await prisma.itemRestriction.count();
  const configs = await prisma.appConfig.count();
  console.log(`Seed complete: ${rules} restriction rules, 1 corridor price, ${configs} configs.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
