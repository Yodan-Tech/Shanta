import { handle, ok } from "@/lib/api/response";
import { requireApiAdminRole } from "@/lib/api/context";
import { AnalyticsService } from "@/lib/services/analytics-service";

// GET /api/v1/admin/intelligence/pricing — corridor rates, pricing tiers, revenue breakdown.
export function GET() {
  return handle(async () => {
    await requireApiAdminRole("OPERATIONS", "FINANCE", "SUPER_ADMIN");
    return ok(await new AnalyticsService().pricing());
  });
}
