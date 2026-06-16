import { type NextRequest } from "next/server";
import { handle, ok } from "@/lib/api/response";
import { requireApiAdminRole } from "@/lib/api/context";
import { getRepositories } from "@/lib/db/prisma-repositories";
import { ApiError } from "@/lib/api/errors";

export function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  return handle(async () => {
    const admin = await requireApiAdminRole("KYC_REVIEWER", "SUPER_ADMIN");
    const { userId } = await params;
    const repos = getRepositories();

    const current = await repos.kyc.getStatus(userId);
    if (!current) throw ApiError.notFound("User not found.");
    if (current !== "PENDING_REVIEW") {
      throw ApiError.unprocessable(
        `KYC status must be PENDING_REVIEW to approve (currently ${current}).`,
      );
    }

    await repos.kyc.approve({ userId, reviewedBy: admin.id });
    return ok({ kycStatus: "VERIFIED" });
  });
}
