import { handle, ok } from "@/lib/api/response";
import { requireApiAdminRole } from "@/lib/api/context";
import { AnalyticsService } from "@/lib/services/analytics-service";

// GET /api/v1/admin/intelligence/reliability — traveler reliability tiers + flagged list.
// INTERNAL ONLY — Constraint 2.1 compliant (no public-facing leaderboard).
export function GET() {
  return handle(async () => {
    await requireApiAdminRole("OPERATIONS", "SUPER_ADMIN");
    return ok(await new AnalyticsService().reliability());
  });
}
