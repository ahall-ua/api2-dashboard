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
  type BuildInfo,
} from "@/lib/bamboo-api";

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
  const map = await buildReleaseNameMap(allPlans);
  const builds: Record<string, BuildInfo> = {};

  if (releaseNamesParam) {
    // Only return matches for the requested release names
    for (const name of releaseNamesParam.split(",")) {
      const info = map.get(name);
      if (info) builds[name] = info;
    }
  } else {
    for (const [name, info] of map) {
      builds[name] = info;
    }
  }

  return NextResponse.json({ builds });
}
