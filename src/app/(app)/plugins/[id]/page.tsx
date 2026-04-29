import { getReadOnlyToken, getSessionEnv } from "@/lib/session";
import { api2FetchJson, fetchAllVersions } from "@/lib/api2-client";
import { VersionHistory } from "@/components/version-history";
import { BambooLinks } from "@/components/bamboo-links";
import { fetchBambooManifest, findProductsForPlugin } from "@/lib/bamboo-manifest";
import type { Api2Plugin } from "@/lib/types";
import { redirect } from "next/navigation";

export default async function PluginDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ geocities?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const backHref = sp.geocities === "1" ? "/dashboard?geocities=1" : "/dashboard";
  const token = await getReadOnlyToken();
  if (!token) redirect("/login");

  const env = await getSessionEnv();

  const [plugin, versions, manifest] = await Promise.all([
    api2FetchJson<Api2Plugin>(`/plugins/${id}`, token, {}, env).catch(() => null),
    fetchAllVersions(`/plugins/${id}/versions`, token, env),
    fetchBambooManifest(),
  ]);

  const pluginName = plugin?.description || plugin?.name || `Plugin ${id}`;
  const bambooProducts = manifest && plugin ? findProductsForPlugin(manifest, plugin.name) : [];

  const header = (
    <div className="mb-6">
      <h2 className="text-xl font-semibold">{pluginName}</h2>
      {plugin && (
        <p className="text-sm text-muted-foreground">
          {plugin.name} &middot; {plugin.type} &middot; {versions.length} versions
        </p>
      )}
      {bambooProducts.length > 0 && (
        <div className="mt-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Bamboo Plans</h3>
          <BambooLinks products={bambooProducts} />
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-[1400px]">
      <a href={backHref} className="text-sm text-muted-foreground hover:underline mb-2 inline-block">
        &larr; Back
      </a>
      <VersionHistory versions={versions} kind="plugins" productId={Number(id)} appName={plugin?.name} productType={plugin?.type} header={header} />
    </div>
  );
}
