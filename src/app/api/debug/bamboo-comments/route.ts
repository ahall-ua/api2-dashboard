import { NextResponse } from "next/server";
import { fetchBambooManifest, findProductsForApp, findProductsForPlugin } from "@/lib/bamboo-manifest";

const BAMBOO_API = "https://bamboo.uaudio.com/rest/api/latest";

/**
 * Probe what Bamboo actually returns for comments + labels.
 *   /api/debug/bamboo-comments?key=HB-LUNA-1234        — inspect one build by Bamboo key
 *   /api/debug/bamboo-comments?plan=HB-LUNA            — list recent builds in plan
 *   /api/debug/bamboo-comments?product=LUNA            — auto-resolve plan(s) from manifest, list builds
 *   /api/debug/bamboo-comments?product=LUNA&version=2.0.3.4390  — find that build, inspect it
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const plan = url.searchParams.get("plan");

  const token = process.env.BAMBOO_TOKEN;
  if (!token) return NextResponse.json({ error: "BAMBOO_TOKEN not set" }, { status: 500 });
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

  if (plan) {
    const r = await fetch(`${BAMBOO_API}/result/${plan}?max-results=5`, { headers });
    return NextResponse.json({
      url: `${BAMBOO_API}/result/${plan}?max-results=5`,
      status: r.status,
      body: r.ok ? await r.json() : await r.text(),
    });
  }

  if (key) {
    const u = `${BAMBOO_API}/result/${key}?expand=comments.comment,labels.label,metadata,variables`;
    const r = await fetch(u, { headers });
    if (!r.ok) return NextResponse.json({ url: u, status: r.status, body: await r.text() }, { status: r.status });
    const body = await r.json();

    // Hunt for sentry.io URLs in any string field
    const sentryHits: string[] = [];
    function walk(obj: unknown, path: string) {
      if (typeof obj === "string") {
        const matches = obj.match(/https:\/\/[^\s"'<>)]*sentry\.io[^\s"'<>)]*/gi);
        if (matches) for (const m of matches) sentryHits.push(`${path}: ${m}`);
      } else if (Array.isArray(obj)) {
        obj.forEach((v, i) => walk(v, `${path}[${i}]`));
      } else if (obj && typeof obj === "object") {
        for (const [k, v] of Object.entries(obj)) walk(v, path ? `${path}.${k}` : k);
      }
    }
    walk(body, "");

    return NextResponse.json({
      url: u,
      status: r.status,
      sentryHits,
      comments: body.comments,
      labels: body.labels,
      metadata: body.metadata,
      variableCount: body.variables?.size,
      // Show first 30 variable names so we can spot sentry-related ones
      variableNames: (body.variables?.variable || []).slice(0, 30).map((v: { name: string }) => v.name),
    });
  }

  return NextResponse.json({ error: "supply ?key=BUILD-KEY or ?plan=PROJECT-PLAN" }, { status: 400 });
}
