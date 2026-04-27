import { getReadOnlyToken, getSessionEnv } from "@/lib/session";
import { redirect } from "next/navigation";
import { fetchMatrix } from "@/lib/fetch-matrix";
import { MonitorView } from "@/components/monitor-view";

export default async function MonitorPage() {
  const token = await getReadOnlyToken();
  if (!token) redirect("/login");

  const env = await getSessionEnv();

  const [appRows, pluginRows] = await Promise.all([
    fetchMatrix("/apps", token, env),
    fetchMatrix("/plugins", token, env),
  ]);

  return <MonitorView appRows={appRows} pluginRows={pluginRows} />;
}
