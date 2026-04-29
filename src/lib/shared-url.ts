// Shared filter / display state that travels across pages.
// Listed here in canonical order so URLs come out stable.
export const SHARED_KEYS = ["show", "phase", "branches", "bamboo", "sentry", "geocities"] as const;

/**
 * Build a URL appending the shared filter params from a Next.js
 * server-component `searchParams` object onto a base path.
 *   buildSharedUrl("/dashboard", { show: ["apps", "uadx"], geocities: "1" })
 *   → "/dashboard?show=apps&show=uadx&geocities=1"
 */
export function buildSharedUrl(
  base: string,
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();
  for (const key of SHARED_KEYS) {
    const value = searchParams[key];
    if (value == null) continue;
    if (Array.isArray(value)) for (const v of value) params.append(key, v);
    else params.append(key, value);
  }
  const qs = params.toString();
  return `${base}${qs ? `?${qs}` : ""}`;
}
