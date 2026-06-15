import { handle, ok } from "@/lib/api/response";
import { requireApiProfile } from "@/lib/api/context";
import { getRepositories } from "@/lib/db/prisma-repositories";

// GET /api/v1/rules — active item-restriction rules for the user's country.
// Lets the UI show categories, caps, and prohibitions. Any authenticated user.
export function GET() {
  return handle(async () => {
    const profile = await requireApiProfile();
    const rules = await getRepositories().rules.findActive(profile.countryCode);
    return ok(rules);
  });
}
