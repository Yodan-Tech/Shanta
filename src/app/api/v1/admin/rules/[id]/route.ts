import { type NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok } from "@/lib/api/response";
import { requireApiAdminRole } from "@/lib/api/context";
import { ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";

const updateRuleSchema = z.object({
  maxWeightKg: z.number().positive().nullable().optional(),
  maxValueEtb: z.number().positive().nullable().optional(),
  prohibited: z.boolean().optional(),
  requiresDeclaration: z.boolean().optional(),
  requiresSpecialPermit: z.boolean().optional(),
  effectiveUntil: z.string().datetime().nullable().optional(),
});

export function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const admin = await requireApiAdminRole("SUPER_ADMIN");
    const { id } = await params;
    const body = updateRuleSchema.parse(await req.json());

    const existing = await prisma.itemRestriction.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound("Rule not found.");

    const updated = await prisma.itemRestriction.update({
      where: { id },
      data: {
        ...(body.maxWeightKg !== undefined ? { maxWeightKg: body.maxWeightKg } : {}),
        ...(body.maxValueEtb !== undefined ? { maxValueEtb: body.maxValueEtb } : {}),
        ...(body.prohibited !== undefined ? { prohibited: body.prohibited } : {}),
        ...(body.requiresDeclaration !== undefined ? { requiresDeclaration: body.requiresDeclaration } : {}),
        ...(body.requiresSpecialPermit !== undefined ? { requiresSpecialPermit: body.requiresSpecialPermit } : {}),
        ...(body.effectiveUntil !== undefined ? { effectiveUntil: body.effectiveUntil ? new Date(body.effectiveUntil) : null } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorType: "ADMIN",
        actorId: admin.id,
        action: "rule.update",
        entityType: "ItemRestriction",
        entityId: id,
        beforeState: { maxWeightKg: String(existing.maxWeightKg), prohibited: existing.prohibited },
        afterState: body,
      },
    });

    return ok(updated);
  });
}

export function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const admin = await requireApiAdminRole("SUPER_ADMIN");
    const { id } = await params;

    const existing = await prisma.itemRestriction.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound("Rule not found.");

    // Soft-delete: set effectiveUntil to now so the rule stops applying.
    await prisma.itemRestriction.update({
      where: { id },
      data: { effectiveUntil: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        actorType: "ADMIN",
        actorId: admin.id,
        action: "rule.delete",
        entityType: "ItemRestriction",
        entityId: id,
        beforeState: { itemCategory: existing.itemCategory },
      },
    });

    return ok({ deleted: true });
  });
}
