import { type NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok } from "@/lib/api/response";
import { requireApiAdminRole } from "@/lib/api/context";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

// GET /api/v1/admin/receiver-requests — all receiver requests with filters.
export function GET(req: NextRequest) {
  return handle(async () => {
    await requireApiAdminRole("OPERATIONS", "SUPER_ADMIN");
    const { searchParams } = new URL(req.url);
    const { status, page, limit } = querySchema.parse(Object.fromEntries(searchParams));

    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      prisma.receiverRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.receiverRequest.count({ where }),
    ]);

    return ok({ items, total, page, limit });
  });
}
