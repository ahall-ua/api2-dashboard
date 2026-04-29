// Pure parsing helpers for the `?show=` URL param. Lives outside any
// "use client" file so server components can import without the
// "client function from server" runtime error.

/**
 * Coerce Next.js's `searchParams` value (which is `string | string[] | undefined`
 * for repeated-key URL params like `?show=apps&show=uadx`) into a plain array.
 * Also accepts the client-side equivalent: a list from `URLSearchParams.getAll()`.
 */
export function toArray(value: string | string[] | null | undefined): string[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function parseShow(
  value: string | string[] | null | undefined,
  available: readonly string[],
): Set<string> {
  const parts = toArray(value).flatMap((v) => v.split(",")).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return new Set(available);
  const valid = parts.filter((k) => available.includes(k));
  return valid.length > 0 ? new Set(valid) : new Set(available);
}

const PLUGIN_KEYS = ["uadx", "uadx-luna", "uad2", "external", "plugins-other"] as const;

/**
 * Decide which endpoints to fetch based on the `?show=` param.
 * `available` should match the page's ShowFilter `available` array.
 */
export function fetchPlanFromShow(
  value: string | string[] | null | undefined,
  available: readonly string[],
): { fetchApps: boolean; fetchPlugins: boolean; fetchFirmware: boolean } {
  const active = parseShow(value, available);
  return {
    fetchApps: active.has("apps"),
    fetchPlugins: PLUGIN_KEYS.some((k) => available.includes(k) && active.has(k)),
    fetchFirmware: available.includes("firmware") && active.has("firmware"),
  };
}
