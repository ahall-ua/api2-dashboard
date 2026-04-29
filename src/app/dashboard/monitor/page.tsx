import { getReadOnlyToken, getSessionEnv, getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { fetchMatrix } from "@/lib/fetch-matrix";
import { MonitorView } from "@/components/monitor-view";

export default async function MonitorPage() {
  const token = await getReadOnlyToken();
  if (!token) redirect("/login");

  const env = await getSessionEnv();
  const session = await getSession();
  const username = session.username;

  const [appRows, pluginRows] = await Promise.all([
    fetchMatrix("/apps", token, env, { username }),
    fetchMatrix("/plugins", token, env, { username }),
  ]);

  return <MonitorView appRows={appRows} pluginRows={pluginRows} />;
}
