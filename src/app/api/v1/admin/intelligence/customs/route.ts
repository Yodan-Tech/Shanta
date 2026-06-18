import { z } from "zod";
import { Prisma } from "@prisma/client";
import { handle, ok, created } from "@/lib/api/response";
import { requireApiAdminRole } from "@/lib/api/context";
import { AnalyticsService } from "@/lib/services/analytics-service";
import { prisma } from "@/lib/prisma";
import { publicEnv } from "@/lib/env";

// GET /api/v1/admin/intelligence/customs — what customs flagged/taxed, by category.
export function GET() {
  return handle(async () => {
    await requireApiAdminRole("OPERATIONS");
    return ok(await new AnalyticsService().customs());
  });
}

const customsEventSchema = z.object({
  shipmentId: z.string().uuid().optional(),
  itemCategory: z.string().min(1).max(64),
  originRegion: z.string().min(1).max(80),
  destinationRegion: z.string().min(1).max(80),
  outcome: z.enum(["CLEARED", "FLAGGED", "TAXED", "SEIZED"]),
  travelerFrequencyTier: z.enum(["NON_FREQUENT", "FREQUENT"]).optional(),
  taxAmountEtb: z.number().nonnegative().optional(),
  detail: z.record(z.string(), z.unknown()).optional(),
});

// POST /api/v1/admin/intelligence/customs — record a REAL customs outcome (ops).
// This is how Shanta learns what customs actually flags/taxes and feeds it back
// into the rules engine (admin-editable caps). OPERATIONS role.
export function POST(req: Request) {
  return handle(async () => {
    const admin = await requireApiAdminRole("OPERATIONS");
    const body = customsEventSchema.parse(await req.json());
    const event = await prisma.customsEvent.create({
      data: {
        ...(body.shipmentId ? { shipmentId: body.shipmentId } : {}),
        itemCategory: body.itemCategory,
        originRegion: body.originRegion,
        destinationRegion: body.destinationRegion,
        outcome: body.outcome,
        ...(body.travelerFrequencyTier
          ? { travelerFrequencyTier: body.travelerFrequencyTier }
          : {}),
        ...(body.taxAmountEtb !== undefined ? { taxAmountEtb: body.taxAmountEtb } : {}),
        ...(body.detail ? { detail: body.detail as Prisma.InputJsonValue } : {}),
        recordedBy: admin.id,
        countryCode: publicEnv.countryCode,
      },
    });
    return created({ id: event.id });
  });
}
