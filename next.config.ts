import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Next.js 16 / App Router. Business logic runs server-side (route handlers +
  // server actions) against Supabase Postgres via Prisma — see docs/ARCHITECTURE.md.
};

export default withNextIntl(nextConfig);
