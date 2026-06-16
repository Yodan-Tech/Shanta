import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api/response";
import { deliveryConfirmSchema } from "@/lib/api/schemas";
import { deliveryService } from "@/lib/api/wiring";

// POST /api/v1/delivery/confirm — NO LOGIN. The receiver (SMS-first, often no app)
// confirms via the signed token from their SMS link. `problem: true` → DISPUTED
// (escrow stays HELD); otherwise → DELIVERY_CONFIRMED. The token is the authorization.
export function POST(req: NextRequest) {
  return handle(async () => {
    const body = deliveryConfirmSchema.parse(await req.json());
    const out = await deliveryService().confirmByToken({
      token: body.token,
      problem: body.problem,
      ...(body.reason ? { reason: body.reason } : {}),
    });
    return ok(out);
  });
}
