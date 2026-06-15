import { ZodError } from "zod";
import { DomainError } from "@/lib/domain/types";

/** API error codes returned to clients (stable contract for the UI). */
export type ApiErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_FAILED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE"
  | "RULES_FAILED"
  | "INTERNAL";

const STATUS: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_FAILED: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  RULES_FAILED: 422,
  INTERNAL: 500,
};

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get status(): number {
    return STATUS[this.code];
  }

  static badRequest(m: string, d?: unknown) {
    return new ApiError("BAD_REQUEST", m, d);
  }
  static validation(m: string, d?: unknown) {
    return new ApiError("VALIDATION_FAILED", m, d);
  }
  static unauthorized(m = "Authentication required") {
    return new ApiError("UNAUTHORIZED", m);
  }
  static forbidden(m = "You do not have access to this resource") {
    return new ApiError("FORBIDDEN", m);
  }
  static notFound(m = "Not found") {
    return new ApiError("NOT_FOUND", m);
  }
  static conflict(m: string, d?: unknown) {
    return new ApiError("CONFLICT", m, d);
  }
  static unprocessable(m: string, d?: unknown) {
    return new ApiError("UNPROCESSABLE", m, d);
  }
  static rulesFailed(m: string, d?: unknown) {
    return new ApiError("RULES_FAILED", m, d);
  }
}

/** Normalises any thrown value into an ApiError for the response layer. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;

  if (err instanceof ZodError) {
    return new ApiError("VALIDATION_FAILED", "Request validation failed.", err.issues);
  }

  if (err instanceof DomainError) {
    switch (err.code) {
      case "ILLEGAL_TRANSITION":
      case "TERMINAL_STATE":
        return new ApiError("CONFLICT", err.message);
      case "GUARD_UNMET":
        return new ApiError("UNPROCESSABLE", err.message);
      case "INVALID_INPUT":
        return new ApiError("BAD_REQUEST", err.message);
    }
  }

  return new ApiError(
    "INTERNAL",
    "An unexpected error occurred.",
    process.env.NODE_ENV === "development" && err instanceof Error
      ? err.message
      : undefined,
  );
}
