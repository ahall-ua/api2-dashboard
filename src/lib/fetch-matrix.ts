import { getEnvConfig, type Api2Env } from "./api2-client";
import { mergeIntoMatrix, cascadePhases, hasStandardVersions, hasFirmwareVersions } from "./version-utils";
import type { Api2App, Api2Plugin, MatrixRow } from "./types";
import { PLATFORMS, FIRMWARE_PLATFORMS } from "./types";

const ALL_FETCH_PHASES = ["dev", "alpha", "beta", "rc", "final", "internal_dev", "internal_final", "branch", "revoke"] as const;

interface RequestTiming {
  endpoint: string;
  phase: string;
  platform: string;
  ms: number;
  pages: number;
  rows: number;
  bytes: number;
}

async function api2GetAll<T>(
  endpoint: string,
  token: string,
  params: Record<string, string>,
  env: Api2Env,
  timings?: RequestTiming[],
): Promise<T[]> {
  const config = getEnvConfig(env);
  const start = Date.now();
  const headers = {
    Authorization: token,
    "X-Api-Key": config.apiKey,
    Accept: "application/json",
  };

  function urlFor(page: number): string {
    const url = new URL(endpoint, config.baseUrl);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return url.toString();
  }

  async function fetchPage(page: number): Promise<{ data: T[]; bytes: number; totalPages: number }> {
    const res = await fetch(urlFor(page), { headers, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`API2 ${endpoint}: ${res.status}`);
    const text = await res.text();
    const totalPages = parseInt(res.headers.get("totalpages") ?? "1", 10) || 1;
    return { data: JSON.parse(text) as T[], bytes: text.length, totalPages };
  }

  const first = await fetchPage(1);
  let results = first.data;
  let bytes = first.bytes;
  const totalPages = first.totalPages;

  if (totalPages > 1) {
    const pages = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) => fetchPage(i + 2)),
    );
    for (const p of pages) {
      results = results.concat(p.data);
      bytes += p.bytes;
    }
  }

  if (timings) {
    timings.push({
      endpoint,
      phase: params.version_phase ?? "",
      platform: params.version_platform ?? "",
      ms: Date.now() - start,
      pages: totalPages,
      rows: results.length,
      bytes,
    });
  }

  return results;
}

interface CacheEntry {
  data: MatrixRow[];
  expiresAt: number;
}
const matrixCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

export async function fetchMatrix(
  endpoint: string,
  token: string,
  env: Api2Env,
  options: { includeFirmware?: boolean } = {},
): Promise<MatrixRow[]> {
  const cacheKey = `${env}:${endpoint}:${options.includeFirmware ? "fw" : "std"}`;
  const cached = matrixCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const matrix = new Map<number, MatrixRow>();
  const platformVariants: string[] = [...PLATFORMS, "all"];
  if (options.includeFirmware) platformVariants.push(...FIRMWARE_PLATFORMS);

  const timings: RequestTiming[] = [];
  const wallStart = Date.now();

  let failures = 0;
  const requests = ALL_FETCH_PHASES.flatMap((phase) =>
    platformVariants.map(async (platform) => {
      try {
        const products = await api2GetAll<Api2App | Api2Plugin>(
          endpoint,
          token,
          { version_phase: phase, version_platform: platform },
          env,
          timings,
        );
        for (const product of products) {
          mergeIntoMatrix(matrix, product, phase, platform);
        }
      } catch (err) {
        failures++;
        console.warn(`api2 ${endpoint} ${phase}/${platform} failed:`, err instanceof Error ? err.message : err);
      }
    }),
  );

  await Promise.all(requests);

  if (process.env.API2_TIMING === "1") {
    logTimingSummary(endpoint, timings, Date.now() - wallStart);
  }

  const rows = [...matrix.values()];
  cascadePhases(rows);

  const HIDDEN_PRODUCTS = new Set(["OX_app"]);

  const result = rows.filter((row) =>
    !HIDDEN_PRODUCTS.has(row.name) &&
    (hasStandardVersions(row) || hasFirmwareVersions(row)),
  );

  // Don't cache empty/degraded results — they're almost always a transient
  // auth or upstream failure, and caching them locks users out for the TTL.
  if (result.length > 0 && failures === 0) {
    matrixCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
  } else if (failures > 0) {
    console.warn(`api2 ${endpoint}: ${failures} requests failed, skipping cache write`);
  }
  return result;
}

function logTimingSummary(endpoint: string, timings: RequestTiming[], wallMs: number): void {
  const total = timings.reduce((s, t) => s + t.ms, 0);
  const totalBytes = timings.reduce((s, t) => s + t.bytes, 0);
  const totalRows = timings.reduce((s, t) => s + t.rows, 0);
  const totalPages = timings.reduce((s, t) => s + t.pages, 0);
  const sorted = [...timings].sort((a, b) => b.ms - a.ms);

  console.log(`\n=== ${endpoint} timing (${timings.length} requests, ${totalPages} pages) ===`);
  console.log(`  wall: ${wallMs}ms | sum-of-requests: ${total}ms | rows: ${totalRows} | bytes: ${(totalBytes / 1024).toFixed(1)}KB`);
  console.log(`  top 10 slowest:`);
  for (const t of sorted.slice(0, 10)) {
    console.log(`    ${t.ms.toString().padStart(5)}ms  ${t.phase.padEnd(15)} ${t.platform.padEnd(8)}  ${t.rows} rows, ${t.pages} pages, ${(t.bytes / 1024).toFixed(1)}KB`);
  }
  const empty = timings.filter((t) => t.rows === 0).length;
  console.log(`  empty responses: ${empty} / ${timings.length}`);
}
