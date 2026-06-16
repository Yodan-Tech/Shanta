/**
 * Thin structured logger. In production emits JSON lines with correlationId
 * (readable by Vercel log drains and Sentry breadcrumbs). In dev, plain console.
 */

export type LogLevel = "info" | "warn" | "error";

export function log(
  correlationId: string,
  level: LogLevel,
  msg: string,
  meta?: Record<string, unknown>,
): void {
  if (process.env.NODE_ENV === "production") {
    console[level](
      JSON.stringify({
        correlationId,
        level,
        msg,
        ts: new Date().toISOString(),
        ...meta,
      }),
    );
  } else if (process.env.NODE_ENV !== "test") {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    console[level](`[${level.toUpperCase()}] [${correlationId}] ${msg}${metaStr}`);
  }
}
