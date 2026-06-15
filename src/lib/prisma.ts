import { PrismaClient } from "@prisma/client";

/**
 * Single Prisma client instance. In dev, Next.js hot-reload would otherwise create
 * a new client on every reload and exhaust the connection pool — so we cache it on
 * globalThis. Connects to Supabase Postgres via the pooled DATABASE_URL.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
