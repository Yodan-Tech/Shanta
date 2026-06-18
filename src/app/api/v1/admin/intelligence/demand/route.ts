import { handle, ok } from "@/lib/api/response";
import { requireApiAdminRole } from "@/lib/api/context";
import { AnalyticsService } from "@/lib/services/analytics-service";

// GET /api/v1/admin/intelligence/demand — what's needed where (+ unmet demand).
export function GET() {
  return handle(async () => {
    await requireApiAdminRole("OPERATIONS");
    return ok(await new AnalyticsService().demand());
  });
}
