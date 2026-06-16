import { handle, ok } from "@/lib/api/response";
import { requireApiAdminRole } from "@/lib/api/context";
import { getRepositories } from "@/lib/db/prisma-repositories";
import { signedKycUrl } from "@/lib/storage/kyc-storage";

export function GET() {
  return handle(async () => {
    await requireApiAdminRole("KYC_REVIEWER", "SUPER_ADMIN");
    const repos = getRepositories();

    const items = await repos.kyc.listPending(50);

    // Sign each ID document URL — never expose raw storage paths to clients.
    const withSignedUrls = await Promise.all(
      items.map(async (item) => {
        const idDocumentUrl = item.idDocumentPath
          ? await signedKycUrl(item.idDocumentPath).catch(() => null)
          : null;
        return {
          userId: item.userId,
          phone: item.phone,
          fullName: item.fullName,
          kycStatus: item.kycStatus,
          kycSubmittedAt: item.kycSubmittedAt,
          idDocumentUrl,
          // idDocumentPath is intentionally omitted from the response
        };
      }),
    );

    return ok({ items: withSignedUrls, total: withSignedUrls.length });
  });
}
