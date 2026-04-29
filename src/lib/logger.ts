/**
 * Thin structured-logging shim. Emits one JSON object per line so CloudWatch
 * and similar log shippers can ingest it without a parser.
 *
 * This is a placeholder — Section 8.5 of the AI-Assisted Application policy
 * requires the company-approved `[internal-logger-ts]` library for Tier 3
 * apps. When that package is available, swap the body of the methods below
 * to delegate to it. The call sites in the codebase shouldn't need to change.
 *
 * Usage:
 *   import { log } from "@/lib/logger";
 *   log.info("matrix fetched", { endpoint: "/apps", rows: 59 });
 *   log.warn("api2 request failed", { status: 500, endpoint: "/apps" });
 *
 * Never include user credentials, api2 tokens, or full URLs containing
 * secrets in `meta`. The `redact` step below scrubs common credential
 * field names defensively, but call sites should still be careful.
 */

type Level = "info" | "warn" | "error";

const REDACTED = "[REDACTED]";
const REDACT_KEYS = new Set([
  "password",
  "token",
  "auth_token",
  "authorization",
  "api_key",
  "apiKey",
  "x-api-key",
  "session",
  "cookie",
]);

function redact(meta: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    out[k] = REDACT_KEYS.has(k.toLowerCase()) ? REDACTED : v;
  }
  return out;
}

function emit(level: Level, msg: string, meta?: Record<string, unknown>) {
  const record = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...redact(meta),
  };
  // Use the corresponding console method so log shippers / dev tools
  // categorize correctly.
  const line = JSON.stringify(record);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (msg: string, meta?: Record<string, unknown>) => emit("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
};
