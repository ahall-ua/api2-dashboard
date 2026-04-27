import { NextRequest, NextResponse } from "next/server";
import { getValidToken } from "@/lib/session";
import {
  fetchBambooManifest,
  findProductsForApp,
  findProductsForPlugin,
} from "@/lib/bamboo-manifest";
import { findBuildByReleaseName } from "@/lib/bamboo-api";

/**
 * GET /api/bamboo/redirect?product=LUNA&kind=apps&releaseName=2.0.3.8978
 *
 * Resolves the Bamboo build URL by matching the release name and redirects to it.
 * Falls back to the product detail page if no build is found.
 */
export async function GET(request: NextRequest) {
  const token = await getValidToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const product = request.nextUrl.searchParams.get("product");
  const kind = request.nextUrl.searchParams.get("kind") as "apps" | "plugins" | null;
  const releaseName = request.nextUrl.searchParams.get("releaseName");
  const fallback = request.nextUrl.searchParams.get("fallback") || "/dashboard";

  if (!product || !kind || !releaseName) {
    return NextResponse.redirect(new URL(fallback, request.url));
  }

  const manifest = await fetchBambooManifest();
  if (!manifest) {
    return NextResponse.redirect(new URL(fallback, request.url));
  }

  const products =
    kind === "apps"
      ? findProductsForApp(manifest, product)
      : findProductsForPlugin(manifest, product);

  if (products.length === 0) {
    return NextResponse.redirect(new URL(fallback, request.url));
  }

  const allPlans: Record<string, { project_key: string; plan_key: string }> = {};
  for (const p of products) {
    for (const [planType, plan] of Object.entries(p.plans)) {
      allPlans[planType] = plan;
    }
  }

  const result = await findBuildByReleaseName(allPlans, releaseName);
  if (result) {
    return NextResponse.redirect(new URL(result.browseUrl), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  return NextResponse.redirect(new URL(fallback, request.url), {
    headers: { "Cache-Control": "no-store" },
  });
}
