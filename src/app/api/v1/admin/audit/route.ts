import { type NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok } from "@/lib/api/response";
import { requireApiAdminRole } from "@/lib/api/context";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export function GET(req: NextRequest) {
  return handle(async () => {
    await requireApiAdminRole("SUPER_ADMIN");
    const { searchParams } = new URL(req.url);
    const { entityType, entityId, page, limit } = querySchema.parse(
      Object.fromEntries(searchParams),
    );

    const where = {
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return ok({ items, total, page, limit });
  });
}
