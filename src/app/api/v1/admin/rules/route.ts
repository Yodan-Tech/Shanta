import { type NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok } from "@/lib/api/response";
import { requireApiAdminRole } from "@/lib/api/context";
import { prisma } from "@/lib/prisma";

const createRuleSchema = z.object({
  itemCategory: z.string().min(1),
  corridorCode: z.string().nullable().optional(),
  countryCode: z.string().default("ET"),
  maxWeightKg: z.number().positive().nullable().optional(),
  maxValueEtb: z.number().positive().nullable().optional(),
  frequencySensitive: z.boolean().default(false),
  maxWeightKgFrequent: z.number().positive().nullable().optional(),
  requiresDeclaration: z.boolean().default(false),
  requiresSpecialPermit: z.boolean().default(false),
  prohibited: z.boolean().default(false),
  direction: z.enum(["ENTRY", "EXIT", "BOTH"]).default("BOTH"),
  effectiveFrom: z.string().datetime(),
  effectiveUntil: z.string().datetime().nullable().optional(),
});

export function GET() {
  return handle(async () => {
    await requireApiAdminRole("OPERATIONS", "SUPER_ADMIN");
    const rules = await prisma.itemRestriction.findMany({
      where: { effectiveUntil: null },
      orderBy: { itemCategory: "asc" },
    });
    return ok({ items: rules, total: rules.length });
  });
}

export function POST(req: NextRequest) {
  return handle(async () => {
    const admin = await requireApiAdminRole("SUPER_ADMIN");
    const body = createRuleSchema.parse(await req.json());

    const rule = await prisma.itemRestriction.create({
      data: {
        itemCategory: body.itemCategory,
        corridorCode: body.corridorCode ?? null,
        countryCode: body.countryCode,
        maxWeightKg: body.maxWeightKg ?? null,
        maxValueEtb: body.maxValueEtb ?? null,
        frequencySensitive: body.frequencySensitive,
        maxWeightKgFrequent: body.maxWeightKgFrequent ?? null,
        requiresDeclaration: body.requiresDeclaration,
        requiresSpecialPermit: body.requiresSpecialPermit,
        prohibited: body.prohibited,
        direction: body.direction,
        effectiveFrom: new Date(body.effectiveFrom),
        effectiveUntil: body.effectiveUntil ? new Date(body.effectiveUntil) : null,
        sourceRegulation: "Admin-entered via API",
      },
    });

    await prisma.auditLog.create({
      data: {
        actorType: "ADMIN",
        actorId: admin.id,
        action: "rule.create",
        entityType: "ItemRestriction",
        entityId: rule.id,
        afterState: body,
      },
    });

    return ok(rule);
  });
}
