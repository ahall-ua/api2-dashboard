import { getReadOnlyToken, getSessionEnv, getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { fetchMatrix, Api2AuthError } from "@/lib/fetch-matrix";
import { hasStandardVersions, hasFirmwareVersions } from "@/lib/version-utils";
import { fetchBambooManifest, findBranchForApp, findBranchForPlugin, findPlanUrlForApp, findPlanUrlForPlugin } from "@/lib/bamboo-manifest";
import { fetchPlanFromShow } from "@/lib/show-filter-parsing";
import type { MatrixRow } from "@/lib/types";
import { GridContent } from "@/components/grid-content";

const GRID_SHOW_AVAILABLE = ["apps", "uadx", "uadx-luna", "uad2", "external", "content", "plugins-other", "firmware"] as const;

export default async function GridPage({
  searchParams,
}: {
  searchParams: Promise<{ retried?: string; show?: string | string[] }>;
}) {
  const token = await getReadOnlyToken();
  if (!token) redirect("/login");

  const env = await getSessionEnv();
  const session = await getSession();
  const username = session.username;
  const { retried, show } = await searchParams;
  const plan = fetchPlanFromShow(show, GRID_SHOW_AVAILABLE);
  const needsAppsEndpoint = plan.fetchApps || plan.fetchFirmware;

  let allAppRows: MatrixRow[] = [];
  let pluginRows: MatrixRow[] = [];
  try {
    const results = await Promise.all([
      needsAppsEndpoint
        ? fetchMatrix("/apps", token, env, { includeFirmware: plan.fetchFirmware, username })
        : Promise.resolve([] as MatrixRow[]),
      plan.fetchPlugins
        ? fetchMatrix("/plugins", token, env, { username })
        : Promise.resolve([] as MatrixRow[]),
    ]);
    [allAppRows, pluginRows] = results;
  } catch (err) {
    if (err instanceof Api2AuthError) {
      if (retried === "1") redirect("/login");
      redirect(`/api/auth/refresh?next=${encodeURIComponent("/grid?retried=1")}`);
    }
    throw err;
  }

  const manifest = await fetchBambooManifest();
  if (manifest) {
    for (const r of allAppRows) {
      r.branch = findBranchForApp(manifest, r.name);
      r.bambooPlanUrl = findPlanUrlForApp(manifest, r.name);
    }
    for (const r of pluginRows) {
      r.branch = findBranchForPlugin(manifest, r.name);
      r.bambooPlanUrl = findPlanUrlForPlugin(manifest, r.name);
    }
  }

  const appRows = plan.fetchApps ? allAppRows.filter(hasStandardVersions) : [];
  const firmwareRows = plan.fetchFirmware ? allAppRows.filter(hasFirmwareVersions) : [];

  return <GridContent appRows={appRows} pluginRows={pluginRows} firmwareRows={firmwareRows} env={env} />;
}
