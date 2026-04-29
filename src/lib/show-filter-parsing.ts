// Pure parsing helpers for the `?show=` URL param. Lives outside any
// "use client" file so server components can import without the
// "client function from server" runtime error.

export function parseShow(param: string | null | undefined, available: readonly string[]): Set<string> {
  if (!param) return new Set(available);
  const parts = param.split(",").map((s) => s.trim()).filter(Boolean);
  const valid = parts.filter((k) => available.includes(k));
  return valid.length > 0 ? new Set(valid) : new Set(available);
}

const PLUGIN_KEYS = ["uadx", "uadx-luna", "uad2", "external", "plugins-other"] as const;

/**
 * Decide which endpoints to fetch based on the `?show=` param.
 * `available` should match the page's ShowFilter `available` array.
 */
export function fetchPlanFromShow(
  param: string | null | undefined,
  available: readonly string[],
): { fetchApps: boolean; fetchPlugins: boolean; fetchFirmware: boolean } {
  const active = parseShow(param ?? null, available);
  return {
    fetchApps: active.has("apps"),
    fetchPlugins: PLUGIN_KEYS.some((k) => available.includes(k) && active.has(k)),
    fetchFirmware: available.includes("firmware") && active.has("firmware"),
  };
}
