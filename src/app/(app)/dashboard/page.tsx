import { getReadOnlyToken, getSessionEnv, getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { fetchMatrix, Api2AuthError } from "@/lib/fetch-matrix";
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
    [appRows, pluginRows] = await Promise.all([
      fetchMatrix("/apps", token, env, { username }),
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

  return <DashboardView appRows={appRows} pluginRows={pluginRows} />;
}
