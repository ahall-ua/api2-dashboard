import { getReadOnlyToken, getSessionEnv } from "@/lib/session";
import { redirect } from "next/navigation";
import { fetchMatrix } from "@/lib/fetch-matrix";
import { DashboardContent } from "@/components/dashboard-content";

export default async function DashboardPage() {
  const token = await getReadOnlyToken();
  if (!token) redirect("/login");

  const env = await getSessionEnv();

  const [appRows, pluginRows] = await Promise.all([
    fetchMatrix("/apps", token, env),
    fetchMatrix("/plugins", token, env),
  ]);

  return <DashboardContent appRows={appRows} pluginRows={pluginRows} env={env} />;
}
