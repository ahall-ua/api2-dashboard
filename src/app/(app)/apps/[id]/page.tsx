import { getReadOnlyToken, getSessionEnv } from "@/lib/session";
import { api2FetchJson, fetchAllVersions } from "@/lib/api2-client";
import { VersionHistory } from "@/components/version-history";
import { BambooLinks } from "@/components/bamboo-links";
import { fetchBambooManifest, findProductsForApp } from "@/lib/bamboo-manifest";
import type { Api2App } from "@/lib/types";
import { redirect } from "next/navigation";

export default async function AppDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const token = await getReadOnlyToken();
  if (!token) redirect("/login");

  const env = await getSessionEnv();

  const [app, versions, manifest] = await Promise.all([
    api2FetchJson<Api2App>(`/apps/${id}`, token, {}, env).catch(() => null),
    fetchAllVersions(`/apps/${id}/versions`, token, env),
    fetchBambooManifest(),
  ]);

  const appName = app?.description || app?.name || `App ${id}`;
  const bambooProducts = manifest && app ? findProductsForApp(manifest, app.name) : [];

  return (
    <div className="max-w-[1400px]">
      <div className="mb-6">
        <a href="/dashboard" className="text-sm text-muted-foreground hover:underline">
          &larr; Back
        </a>
        <h2 className="text-xl font-semibold mt-2">{appName}</h2>
        {app && (
          <p className="text-sm text-muted-foreground">
            {app.name} &middot; {app.type} &middot; {versions.length} versions
          </p>
        )}
        {bambooProducts.length > 0 && (
          <div className="mt-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Bamboo Plans</h3>
            <BambooLinks products={bambooProducts} />
          </div>
        )}
      </div>

      <VersionHistory versions={versions} kind="apps" productId={Number(id)} appName={app?.name} productType={app?.type} />
    </div>
  );
}
