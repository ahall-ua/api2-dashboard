import { NextResponse } from "next/server";
import { getValidToken, getSessionEnv } from "@/lib/session";
import { getEnvConfig } from "@/lib/api2-client";

export async function GET() {
  const token = await getValidToken();
  if (!token) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  const env = await getSessionEnv();
  const config = getEnvConfig(env);

  const headers = { Authorization: token, "X-Api-Key": config.apiKey, Accept: "application/json" };

  // 1. List all apps (no filters)
  const apps: Array<{ id: number; name: string; type: string }> = [];
  let page = 1;
  while (true) {
    const url = new URL("/apps", config.baseUrl);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    const res = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return NextResponse.json({ step: "list apps", status: res.status }, { status: 500 });
    const data = await res.json();
    apps.push(...data);
    if (data.length < 100) break;
    page++;
  }

  // 2. For each app, fetch /apps/{id}/versions and collect distinct platforms
  const platformCounts = new Map<string, number>();
  const platformProducts = new Map<string, Set<string>>();
  const productPlatforms = new Map<string, Set<string>>();
  let appsScanned = 0;
  let appsWithVersions = 0;

  // Concurrency limit to avoid hammering api2
  const CONCURRENCY = 8;
  let i = 0;
  async function worker() {
    while (i < apps.length) {
      const app = apps[i++];
      const url = new URL(`/apps/${app.id}/versions`, config.baseUrl);
      url.searchParams.set("per_page", "100");
      try {
        const res = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(15_000) });
        appsScanned++;
        if (!res.ok) continue;
        const versions: Array<{ platform: string }> = await res.json();
        if (versions.length > 0) appsWithVersions++;
        for (const v of versions) {
          const plat = v.platform || "(empty)";
          platformCounts.set(plat, (platformCounts.get(plat) || 0) + 1);
          if (!platformProducts.has(plat)) platformProducts.set(plat, new Set());
          platformProducts.get(plat)!.add(app.name);
          if (!productPlatforms.has(app.name)) productPlatforms.set(app.name, new Set());
          productPlatforms.get(app.name)!.add(plat);
        }
      } catch {
        // skip
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // Find products whose platforms are entirely outside {mac, win, all} — these are pure firmware
  const STANDARD = new Set(["mac", "win", "all"]);
  const firmwareProducts: Record<string, string[]> = {};
  for (const [name, plats] of productPlatforms) {
    const nonStandard = [...plats].filter((p) => !STANDARD.has(p));
    if (nonStandard.length > 0) firmwareProducts[name] = [...plats];
  }

  return NextResponse.json({
    env,
    totalApps: apps.length,
    appsScanned,
    appsWithVersions,
    platformCounts: Object.fromEntries([...platformCounts.entries()].sort((a, b) => b[1] - a[1])),
    platformProductSamples: Object.fromEntries(
      [...platformProducts.entries()].map(([k, v]) => [k, [...v].slice(0, 8)]),
    ),
    productsWithFirmwarePlatforms: firmwareProducts,
  });
}
