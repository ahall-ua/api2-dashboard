import { getReadOnlyToken, getSessionEnv, getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { fetchMatrix, Api2AuthError } from "@/lib/fetch-matrix";
import { fetchBambooManifest, findBranchForApp, findBranchForPlugin, findPlanUrlForApp, findPlanUrlForPlugin } from "@/lib/bamboo-manifest";
import { DashboardView } from "@/components/dashboard-view";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ retried?: string; phase?: string }>;
}) {
  const token = await getReadOnlyToken();
  if (!token) redirect("/login");

  const env = await getSessionEnv();
  const session = await getSession();
  const username = session.username;
  const params = await searchParams;

  let appRows, pluginRows;
  try {
    // Use includeFirmware:true so the apps cache key matches the grid page;
    // dashboard ignores firmware rows but back-nav between the two pages is
    // a cache hit instead of a fresh ~5s sweep.
    [appRows, pluginRows] = await Promise.all([
      fetchMatrix("/apps", token, env, { username, includeFirmware: true }),
      fetchMatrix("/plugins", token, env, { username }),
    ]);
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
