import { NextResponse } from "next/server";
import { toApiError } from "./errors";

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
    // Surface server faults in logs; clients only get a generic message.
    console.error(`[${correlationId}]`, err);
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
