import { NextRequest, NextResponse } from "next/server";
import { getValidToken } from "@/lib/session";
import {
  fetchBambooManifest,
  findProductsForApp,
  findProductsForPlugin,
} from "@/lib/bamboo-manifest";
import {
  buildReleaseNameMap,
  findBuildByReleaseName,
  normalizeReleaseName,
  type BuildInfo,
} from "@/lib/bamboo-api";

interface BambooCacheEntry {
  data: Map<string, BuildInfo>;
  expiresAt: number;
}
const bambooBuildsCache = new Map<string, BambooCacheEntry>();
const bambooInFlight = new Map<string, Promise<Map<string, BuildInfo>>>();
const BAMBOO_TTL_MS = 60_000;

// Cache for individual release-name lookups (results don't change once built).
// Stores both hits (BuildInfo) and misses (null) so we don't re-query Bamboo.
const releaseNameCache = new Map<string, { value: BuildInfo | null; expiresAt: number }>();
const releaseNameInFlight = new Map<string, Promise<BuildInfo | null>>();
const RELEASE_NAME_TTL_MS = 10 * 60_000;
const FALLBACK_CONCURRENCY = 8;

async function lookupReleaseName(
  product: string,
  kind: string,
  releaseName: string,
  plans: Record<string, { project_key: string; plan_key: string }>,
): Promise<BuildInfo | null> {
  const key = `${kind}:${product}:${releaseName}`;
  const cached = releaseNameCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  const inFlight = releaseNameInFlight.get(key);
  if (inFlight) return inFlight;

  const promise = findBuildByReleaseName(plans, releaseName)
    .then((value) => {
      releaseNameCache.set(key, { value, expiresAt: Date.now() + RELEASE_NAME_TTL_MS });
      return value;
    })
    .finally(() => releaseNameInFlight.delete(key));
  releaseNameInFlight.set(key, promise);
  return promise;
}

async function getCachedBuildReleaseNameMap(
  kind: string,
  product: string,
  plans: Record<string, { project_key: string; plan_key: string }>,
): Promise<Map<string, BuildInfo>> {
  const key = `${kind}:${product}`;
  const cached = bambooBuildsCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const inFlight = bambooInFlight.get(key);
  if (inFlight) return inFlight;

  const promise = buildReleaseNameMap(plans).then((map) => {
    bambooBuildsCache.set(key, { data: map, expiresAt: Date.now() + BAMBOO_TTL_MS });
    return map;
  }).finally(() => {
    bambooInFlight.delete(key);
  });
  bambooInFlight.set(key, promise);
  return promise;
}

/**
 * GET /api/bamboo/builds?product=LUNA&kind=apps
 * GET /api/bamboo/builds?product=LUNA&kind=apps&releaseNames=0002.0000.0003.008978,0002.0000.0003.008977
 *
 * Returns { builds: { [releaseName]: { resultKey, browseUrl, state } } }
 */
export async function GET(request: NextRequest) {
  const token = await getValidToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const product = request.nextUrl.searchParams.get("product");
  const kind = request.nextUrl.searchParams.get("kind") as
    | "apps"
    | "plugins"
    | null;
  const releaseNamesParam = request.nextUrl.searchParams.get("releaseNames");

  if (!product || !kind) {
    return NextResponse.json(
      { error: "product and kind params required" },
      { status: 400 },
    );
  }

  const manifest = await fetchBambooManifest();
  if (!manifest) {
    return NextResponse.json({ builds: {} });
  }

  const products =
    kind === "apps"
      ? findProductsForApp(manifest, product)
      : findProductsForPlugin(manifest, product);

  if (products.length === 0) {
    return NextResponse.json({ builds: {} });
  }

  // Merge plans from all matching manifest products
  const allPlans: Record<string, { project_key: string; plan_key: string }> =
    {};
  for (const p of products) {
    for (const [planType, plan] of Object.entries(p.plans)) {
      allPlans[planType] = plan;
    }
  }

  // Batch lookup: recent builds from all plans, keyed by release name
  const map = await getCachedBuildReleaseNameMap(kind, product, allPlans);
  const builds: Record<string, BuildInfo> = {};

  if (releaseNamesParam) {
    const kindStr = kind;
    const productStr = product;
    const requested = releaseNamesParam.split(",");
    const missing: string[] = [];
    for (const name of requested) {
      const info = map.get(name) ?? map.get(normalizeReleaseName(name));
      if (info) builds[name] = info;
      else missing.push(name);
    }

    // Fall back to per-build lookup for older versions that aren't in the
    // recent-25 window. Concurrency-limited so we don't spray Bamboo with
    // hundreds of simultaneous requests on a long version history.
    if (missing.length > 0) {
      // Process newest-added names first. The client sends names in
      // scroll-into-view order; reversing means rows currently on-screen
      // (most recently scrolled to) resolve before rows that scrolled past.
      missing.reverse();
      let i = 0;
      async function worker() {
        while (i < missing.length) {
          const name = missing[i++];
          const info = await lookupReleaseName(productStr, kindStr, name, allPlans);
          if (info) builds[name] = info;
        }
      }
      await Promise.all(Array.from({ length: FALLBACK_CONCURRENCY }, worker));
    }
  } else {
    for (const [name, info] of map) {
      builds[name] = info;
    }
  }

  return NextResponse.json({ builds });
}
