import { type NextRequest } from "next/server";
import { handle, ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { notificationService } from "@/lib/api/wiring";

function requireCronSecret(req: NextRequest): void {
  const auth = req.headers.get("Authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    throw ApiError.forbidden("Invalid cron secret.");
  }
}

export function GET(req: NextRequest) {
  return handle(async () => {
    requireCronSecret(req);
    const result = await notificationService().drainOutbox(50);
    return ok(result);
  });
}
