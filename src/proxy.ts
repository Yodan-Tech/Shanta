import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Simple in-memory sliding-window rate limiter. Module-scoped so it resets
 * on cold starts (acceptable for Phase 1 pilot scale). Keyed by IP + path prefix.
 * Production hardening: replace with Upstash Redis when traffic warrants it.
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const RL_STORE = new Map<string, RateLimitEntry>();
const RL_WINDOW_MS = 60_000; // 1 minute

function checkRateLimit(
  key: string,
  limit: number,
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = RL_STORE.get(key);

  if (!entry || entry.resetAt < now) {
    RL_STORE.set(key, { count: 1, resetAt: now + RL_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count++;
  return { allowed: true, retryAfter: 0 };
}

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

/** Rate-limited paths: [pathPrefix, requestsPerMinute] */
const RATE_LIMITS: [string, number][] = [
  ["/api/v1/kyc/submit", 5],
  ["/login", 10],
  ["/verify", 10],
  ["/api/auth", 10],
];

// Next.js 16 "proxy" convention (formerly "middleware"). Refreshes the Supabase
// session, guards authenticated *page* routes, and enforces rate limits on
// sensitive endpoints. API routes (/api/*) are excluded from auth redirect —
// they enforce auth in their own handlers and return JSON envelopes (401/403).
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate limiting check before session refresh.
  for (const [prefix, limit] of RATE_LIMITS) {
    if (pathname.startsWith(prefix)) {
      const ip = getIp(request);
      const key = `${ip}:${prefix}`;
      const { allowed, retryAfter } = checkRateLimit(key, limit);
      if (!allowed) {
        return new NextResponse(
          JSON.stringify({ error: "Too many requests. Please try again later." }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(retryAfter),
            },
          },
        );
      }
      break;
    }
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
