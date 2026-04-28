import { getReadOnlyToken, getSessionEnv, getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { fetchMatrix } from "@/lib/fetch-matrix";
import { hasStandardVersions, hasFirmwareVersions } from "@/lib/version-utils";
import { DashboardContent } from "@/components/dashboard-content";

export default async function DashboardPage() {
  const token = await getReadOnlyToken();
  if (!token) redirect("/login");

  const env = await getSessionEnv();
  const session = await getSession();
  const username = session.username;

  const [allAppRows, pluginRows] = await Promise.all([
    fetchMatrix("/apps", token, env, { includeFirmware: true, username }),
    fetchMatrix("/plugins", token, env, { username }),
  ]);

  const appRows = allAppRows.filter(hasStandardVersions);
  const firmwareRows = allAppRows.filter(hasFirmwareVersions);

  return <DashboardContent appRows={appRows} pluginRows={pluginRows} firmwareRows={firmwareRows} env={env} />;
}
