import { type NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok } from "@/lib/api/response";
import { requireApiAdminRole } from "@/lib/api/context";
import { getRepositories } from "@/lib/db/prisma-repositories";
import { ApiError } from "@/lib/api/errors";

const rejectSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required.").max(500),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  return handle(async () => {
    const admin = await requireApiAdminRole("KYC_REVIEWER", "SUPER_ADMIN");
    const { userId } = await params;
    const repos = getRepositories();

    const body = rejectSchema.parse(await req.json());

    const current = await repos.kyc.getStatus(userId);
    if (!current) throw ApiError.notFound("User not found.");
    if (current !== "PENDING_REVIEW") {
      throw ApiError.unprocessable(
        `KYC status must be PENDING_REVIEW to reject (currently ${current}).`,
      );
    }

    await repos.kyc.reject({
      userId,
      reviewedBy: admin.id,
      reason: body.reason,
    });
    return ok({ kycStatus: "REJECTED" });
  });
}
