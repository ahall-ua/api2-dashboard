import { getReadOnlyToken, getSessionEnv, getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { fetchMatrix, Api2AuthError } from "@/lib/fetch-matrix";
import { fetchBambooManifest, findBranchForApp, findBranchForPlugin, findPlanUrlForApp, findPlanUrlForPlugin } from "@/lib/bamboo-manifest";
import { fetchPlanFromShow } from "@/lib/show-filter-parsing";
import type { MatrixRow } from "@/lib/types";
import { DashboardView } from "@/components/dashboard-view";

const DASHBOARD_SHOW_AVAILABLE = ["apps", "uadx", "uadx-luna", "uad2", "external", "plugins-other"] as const;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ retried?: string; phase?: string; show?: string }>;
}) {
  const token = await getReadOnlyToken();
  if (!token) redirect("/login");

  const env = await getSessionEnv();
  const session = await getSession();
  const username = session.username;
  const params = await searchParams;
  const plan = fetchPlanFromShow(params.show, DASHBOARD_SHOW_AVAILABLE);

  let appRows: MatrixRow[] = [];
  let pluginRows: MatrixRow[] = [];
  try {
    // Match the grid's cache key when fetching apps (`includeFirmware: true`)
    // so back-nav between the two pages is a cache hit. Dashboard ignores
    // firmware rows visually but loading them is cheap if cached.
    const results = await Promise.all([
      plan.fetchApps
        ? fetchMatrix("/apps", token, env, { username, includeFirmware: true })
        : Promise.resolve([] as MatrixRow[]),
      plan.fetchPlugins
        ? fetchMatrix("/plugins", token, env, { username })
        : Promise.resolve([] as MatrixRow[]),
    ]);
    [appRows, pluginRows] = results;
  } catch (err) {
    if (err instanceof Api2AuthError) {
      if (params.retried === "1") redirect("/login");
      const next = `/dashboard?retried=1${params.phase ? `&phase=${encodeURIComponent(params.phase)}` : ""}`;
      redirect(`/api/auth/refresh?next=${encodeURIComponent(next)}`);
    }
    throw err;
  }

  const manifest = await fetchBambooManifest();
  if (manifest) {
    for (const r of appRows) {
      r.branch = findBranchForApp(manifest, r.name);
      r.bambooPlanUrl = findPlanUrlForApp(manifest, r.name);
    }
    for (const r of pluginRows) {
      r.branch = findBranchForPlugin(manifest, r.name);
      r.bambooPlanUrl = findPlanUrlForPlugin(manifest, r.name);
    }
  }

  return <DashboardView appRows={appRows} pluginRows={pluginRows} />;
}
