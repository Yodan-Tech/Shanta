import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// Content Security Policy (Milestone S). Uses 'unsafe-inline' for scripts/styles
// to stay compatible with Next.js App Router without nonces. Tighten to nonce-based
// in a future hardening pass once the app is externally audited.
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  `connect-src 'self' ${SUPABASE_URL} wss://*.supabase.co`,
  `img-src 'self' blob: data: ${SUPABASE_URL}`,
  "media-src 'self' blob:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

// Baseline security headers applied to every response. camera/geolocation
// are allowed for `self` because live-capture handoff photos + geo-tagging need them
// (Constraint 2.2).
const securityHeaders = [
  { key: "Content-Security-Policy", value: cspDirectives },
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
