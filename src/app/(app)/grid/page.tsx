import { getReadOnlyToken, getSessionEnv, getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { fetchMatrix, Api2AuthError } from "@/lib/fetch-matrix";
import { hasStandardVersions, hasFirmwareVersions } from "@/lib/version-utils";
import { fetchBambooManifest, findBranchForApp, findBranchForPlugin, findPlanUrlForApp, findPlanUrlForPlugin } from "@/lib/bamboo-manifest";
import { GridContent } from "@/components/grid-content";

export default async function GridPage({
  searchParams,
}: {
  searchParams: Promise<{ retried?: string }>;
}) {
  const token = await getReadOnlyToken();
  if (!token) redirect("/login");

  const env = await getSessionEnv();
  const session = await getSession();
  const username = session.username;
  const { retried } = await searchParams;

  let allAppRows, pluginRows;
  try {
    [allAppRows, pluginRows, ] = await Promise.all([
      fetchMatrix("/apps", token, env, { includeFirmware: true, username }),
      fetchMatrix("/plugins", token, env, { username }),
    ]);
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

  const appRows = allAppRows.filter(hasStandardVersions);
  const firmwareRows = allAppRows.filter(hasFirmwareVersions);

  return <GridContent appRows={appRows} pluginRows={pluginRows} firmwareRows={firmwareRows} env={env} />;
}
