import { NextResponse } from "next/server";
import { toApiError } from "./errors";
import { log } from "@/lib/logger";

/**
 * Consistent response envelope for all /api/v1 routes (the contract the UI binds to):
 *   success → { data: T }
 *   error   → { error: { code, message, correlation_id, details? } }
 */

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function created<T>(data: T): NextResponse {
  return ok(data, 201);
}

export function fail(err: unknown, correlationId: string): NextResponse {
  const apiError = toApiError(err);
  if (apiError.code === "INTERNAL") {
    // Structured log for Vercel log drains.
    // Wire Sentry: install @sentry/nextjs, set SENTRY_DSN, and call
    // Sentry.captureException(err) here before the log line.
    log(correlationId, "error", "Unhandled server error", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return NextResponse.json(
    {
      error: {
        code: apiError.code,
        message: apiError.message,
        correlation_id: correlationId,
        ...(apiError.details !== undefined
          ? { details: apiError.details }
          : {}),
      },
    },
    { status: apiError.status },
  );
}

/**
 * Wraps a route handler: provides a correlation id and maps any thrown error to
 * the standard envelope. Handlers just return data or throw ApiError/DomainError.
 */
export function handle(
  fn: (correlationId: string) => Promise<NextResponse>,
): Promise<NextResponse> {
  const correlationId = crypto.randomUUID();
  return fn(correlationId).catch((err) => fail(err, correlationId));
}
