import { type NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok } from "@/lib/api/response";
import { requireApiAdminRole } from "@/lib/api/context";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export function GET(req: NextRequest) {
  return handle(async () => {
    await requireApiAdminRole("OPERATIONS", "SUPER_ADMIN");
    const { searchParams } = new URL(req.url);
    const { page, limit } = querySchema.parse(Object.fromEntries(searchParams));

    const [items, total] = await Promise.all([
      prisma.profile.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          phone: true,
          fullName: true,
          roles: true,
          kycStatus: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.profile.count({ where: { deletedAt: null } }),
    ]);

    return ok({ items, total, page, limit });
  });
}
