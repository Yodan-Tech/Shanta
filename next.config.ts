import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Baseline security headers applied to every response. A strict Content-Security-Policy
// (with per-request nonces) is deliberately deferred to Milestone S — these portable
// headers are the safe, high-value subset that won't break the app. camera/geolocation
// are allowed for `self` because live-capture handoff photos + geo-tagging need them
// (Constraint 2.2); everything else is denied.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(self), browsing-topics=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  // Next.js 16 / App Router. Business logic runs server-side (route handlers +
  // server actions) against Supabase Postgres via Prisma — see docs/ARCHITECTURE.md.
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
