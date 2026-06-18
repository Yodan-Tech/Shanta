import { type NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok, created } from "@/lib/api/response";
import { requireApiAdminRole } from "@/lib/api/context";
import { prisma } from "@/lib/prisma";
import { publicEnv } from "@/lib/env";

const createSchema = z.object({
  itemCategory: z.string().min(1).max(64),
  corridorCode: z.string().max(64).optional(),
  rateMultiplier: z.number().positive().default(1.0),
  flatFeeEtb: z.number().nonnegative().default(0),
  minChargeEtb: z.number().nonnegative().optional(),
  pricingBasis: z.enum(["PER_KG", "PER_ITEM", "PER_LUGGAGE", "FLAT"]).default("PER_KG"),
  luggageFlatFeeEtb: z.number().nonnegative().optional(),
  notes: z.string().max(500).optional(),
  effectiveFrom: z.string(), // ISO date string
  effectiveUntil: z.string().optional(),
});

// GET /api/v1/admin/pricing-tiers
export function GET() {
  return handle(async () => {
    await requireApiAdminRole("OPERATIONS", "FINANCE", "SUPER_ADMIN");
    const tiers = await prisma.pricingTier.findMany({
      where: { active: true },
      orderBy: [{ itemCategory: "asc" }, { corridorCode: "asc" }],
    });
    return ok({ items: tiers, total: tiers.length });
  });
}

// POST /api/v1/admin/pricing-tiers
export function POST(req: NextRequest) {
  return handle(async () => {
    const admin = await requireApiAdminRole("SUPER_ADMIN");
    const body = createSchema.parse(await req.json());
    const tier = await prisma.pricingTier.create({
      data: {
        itemCategory: body.itemCategory,
        corridorCode: body.corridorCode ?? null,
        rateMultiplier: body.rateMultiplier,
        flatFeeEtb: body.flatFeeEtb,
        minChargeEtb: body.minChargeEtb ?? null,
        pricingBasis: body.pricingBasis,
        luggageFlatFeeEtb: body.luggageFlatFeeEtb ?? null,
        notes: body.notes ?? null,
        effectiveFrom: new Date(body.effectiveFrom),
        effectiveUntil: body.effectiveUntil ? new Date(body.effectiveUntil) : null,
        countryCode: publicEnv.countryCode,
        createdBy: admin.id,
      },
    });
    return created(tier);
  });
}
