import { NextResponse } from "next/server";
import { getValidToken, getSessionEnv } from "@/lib/session";
import { getEnvConfig } from "@/lib/api2-client";

export async function GET() {
  const token = await getValidToken();
  if (!token) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  const env = await getSessionEnv();
  const config = getEnvConfig(env);

  const tries = [200, 500, 1000, 2000];
  const out: Array<{ per_page: number; status: number; returned: number; totalPages: string | null; totalCount: string | null; ms: number }> = [];
  for (const pp of tries) {
    const url = new URL("/plugins", config.baseUrl);
    url.searchParams.set("per_page", String(pp));
    url.searchParams.set("page", "1");
    url.searchParams.set("version_phase", "dev");
    url.searchParams.set("version_platform", "mac");
    const t0 = Date.now();
    const res = await fetch(url.toString(), {
      headers: { Authorization: token, "X-Api-Key": config.apiKey, Accept: "application/json" },
    });
    const body = await res.json();
    out.push({
      per_page: pp,
      status: res.status,
      returned: Array.isArray(body) ? body.length : -1,
      totalPages: res.headers.get("totalpages"),
      totalCount: res.headers.get("totalcount"),
      ms: Date.now() - t0,
    });
  }
  return NextResponse.json({ env, results: out });
}
