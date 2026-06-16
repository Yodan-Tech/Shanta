import { type NextRequest } from "next/server";
import { handle, ok } from "@/lib/api/response";
import { requireApiAdminRole } from "@/lib/api/context";
import { ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";

export function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  return handle(async () => {
    const admin = await requireApiAdminRole("OPERATIONS", "SUPER_ADMIN");
    const { userId } = await params;

    const user = await prisma.profile.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.notFound("User not found.");
    if (user.status === "SUSPENDED") {
      throw ApiError.unprocessable("User is already suspended.");
    }

    await prisma.profile.update({
      where: { id: userId },
      data: { status: "SUSPENDED" },
    });

    await prisma.auditLog.create({
      data: {
        actorType: "ADMIN",
        actorId: admin.id,
        action: "user.suspend",
        entityType: "Profile",
        entityId: userId,
        beforeState: { status: user.status },
        afterState: { status: "SUSPENDED" },
      },
    });

    return ok({ status: "SUSPENDED" });
  });
}
