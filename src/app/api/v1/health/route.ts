import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Liveness/readiness probe. No auth. Reports DB connectivity. */
export async function GET() {
  let database: "ok" | "error" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }
  const status = database === "ok" ? "ok" : "degraded";
  return NextResponse.json(
    { status, timestamp: new Date().toISOString(), checks: { database } },
    { status: status === "ok" ? 200 : 503 },
  );
}
