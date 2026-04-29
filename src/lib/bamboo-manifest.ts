// Fetch and cache the bamboo manifest from S3.
// The manifest maps products to their Bamboo CI plans, enabling
// links from the dashboard to Bamboo build pages.

const MANIFEST_URL =
  "https://content.apps.uaudio.com/internal/bamboo-manifest.json";

// --- Types matching emit_manifest.py output ---

export interface BambooPlan {
  project_key: string;
  plan_key: string;
}

export interface BambooProduct {
  display_name: string;
  family: string;
  plans: Record<string, BambooPlan>;
  ua_branch?: string;
  ua_package?: string;
  ua_plug_package?: string;
  uapw_package?: string;
  ua_version?: string;
  ua_branch_version?: string;
  ua_api2_name?: string;
  ua_s3_name?: string;
  ua_artifact_basename?: string;
  ua_api2_plugins?: string;
  ua_content_id?: string;
  has_deployment_plan?: boolean;
  supported_platforms?: string[];
}

export interface BambooManifest {
  generated_at: string;
  products: Record<string, BambooProduct>;
  branches: Record<string, string[]>;
}

// --- Fetching with simple TTL cache ---

let cached: { manifest: BambooManifest; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function fetchBambooManifest(): Promise<BambooManifest | null> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.manifest;
  }

  try {
    const res = await fetch(MANIFEST_URL, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return cached?.manifest ?? null;
    const manifest: BambooManifest = await res.json();
    cached = { manifest, fetchedAt: Date.now() };
    return manifest;
  } catch {
    return cached?.manifest ?? null;
  }
}

// --- Lookup helpers ---

const BAMBOO_BASE = "https://bamboo.uaudio.com/browse";

export function bambooPlanUrl(plan: BambooPlan): string {
  return `${BAMBOO_BASE}/${plan.project_key}-${plan.plan_key}`;
}

// Plugin families — these should only match via findProductsForPlugin
const PLUGIN_FAMILIES = new Set(["uad2-plugins", "hbplug"]);

/**
 * Find manifest products matching an api2 app by name.
 * Apps match on ua_api2_name (case-insensitive).
 * Excludes plugin-family products (e.g. uad2-plugins) since those
 * share ua_api2_name with the parent app but have their own pages.
 */
export function findProductsForApp(
  manifest: BambooManifest,
  api2AppName: string,
): BambooProduct[] {
  const needle = api2AppName.toLowerCase();
  return Object.values(manifest.products).filter(
    (p) =>
      p.ua_api2_name?.toLowerCase() === needle &&
      !PLUGIN_FAMILIES.has(p.family),
  );
}

/**
 * Find manifest products matching an api2 plugin by name.
 * UAD2 plugins: match if the plugin name appears in ua_api2_plugins (comma-separated).
 * HBplugs: match by product key convention (product key === plugin name).
 */
export function findBranchForApp(manifest: BambooManifest, appName: string): string | undefined {
  return findProductsForApp(manifest, appName)[0]?.ua_branch;
}

export function findBranchForPlugin(manifest: BambooManifest, pluginName: string): string | undefined {
  return findProductsForPlugin(manifest, pluginName)[0]?.ua_branch;
}

export function findProductsForPlugin(
  manifest: BambooManifest,
  api2PluginName: string,
): BambooProduct[] {
  const needle = api2PluginName.toLowerCase();
  const results: BambooProduct[] = [];

  for (const [key, product] of Object.entries(manifest.products)) {
    // UAD2 plugins: comma-separated list in ua_api2_plugins
    if (product.ua_api2_plugins) {
      const pluginNames = product.ua_api2_plugins
        .split(",")
        .map((s) => s.trim().toLowerCase());
      if (pluginNames.includes(needle)) {
        results.push(product);
        continue;
      }
    }
    // HBplugs: product key matches plugin name
    if (product.family === "hbplug" && key.toLowerCase() === needle) {
      results.push(product);
    }
  }

  return results;
}
