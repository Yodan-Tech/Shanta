import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 "proxy" convention (formerly "middleware"). Refreshes the Supabase
// session and guards authenticated *page* routes. API routes (/api/*) are excluded:
// they enforce auth in their own handlers and return JSON envelopes (401/403), never
// an HTML redirect to /login — a middleware redirect would break every API client.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
