// Server-side Bamboo REST API client.
// Used to resolve deployed versions to specific Bamboo build URLs.

const BAMBOO_ROOT = "https://bamboo.uaudio.com";
const BAMBOO_API = `${BAMBOO_ROOT}/rest/api/latest`;

function getToken(): string {
  return process.env.BAMBOO_TOKEN || "";
}

async function bambooFetch<T>(path: string): Promise<T | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${BAMBOO_API}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

export interface BambooBuildResult {
  buildNumber: number;
  buildResultKey: string; // e.g. "HB-HOUS-1234"
  buildState: string; // "Successful" | "Failed"
  lifeCycleState: string; // "Finished" | "InProgress"
  buildReleaseName?: string; // e.g. "0002.0000.0003.008978" — matches api2 version string
  buildStartedTime?: string;
  buildCompletedTime?: string;
}

export interface BuildInfo {
  resultKey: string;
  browseUrl: string;
  state: string;
}

export function bambooBrowseUrl(buildResultKey: string): string {
  return `${BAMBOO_ROOT}/browse/${buildResultKey}`;
}

function toBuildInfo(r: BambooBuildResult): BuildInfo {
  return {
    resultKey: r.buildResultKey,
    browseUrl: bambooBrowseUrl(r.buildResultKey),
    state: r.buildState,
  };
}

interface BambooVariable {
  name: string;
  value: string;
}

/**
 * Fetch recent build results for a plan key.
 * Expands variables to get inject.uaReleaseName for version matching.
 * Returns up to `limit` results across all states.
 */
async function fetchPlanResults(
  planKey: string,
  limit: number = 25,
): Promise<BambooBuildResult[]> {
  const data = await bambooFetch<{
    results?: {
      result?: (BambooBuildResult & {
        variables?: { variable?: BambooVariable | BambooVariable[] };
      }) | (BambooBuildResult & {
        variables?: { variable?: BambooVariable | BambooVariable[] };
      })[];
    };
  }>(`/result/${planKey}?includeAllStates=true&max-results=${limit}&expand=results.result.variables`);

  if (!data) return [];
  const raw = data.results?.result;
  if (!raw) return [];
  const results = Array.isArray(raw) ? raw : [raw];

  // Extract inject.uaReleaseName from variables into buildReleaseName
  return results.map((r) => {
    const vars = r.variables?.variable;
    if (vars) {
      const list = Array.isArray(vars) ? vars : [vars];
      const releaseVar = list.find((v) => v.name === "inject.uaReleaseName");
      if (releaseVar) {
        r.buildReleaseName = releaseVar.value;
      }
    }
    return r;
  });
}

/**
 * List plan branch keys for a given plan.
 * Returns branch plan keys (e.g. "HB-HOUS0", "HB-HOUS2").
 */
async function fetchPlanBranches(
  planKey: string,
): Promise<string[]> {
  const data = await bambooFetch<{
    branches?: { branch?: { key: string }[] | { key: string } };
  }>(`/plan/${planKey}/branch?max-results=25`);

  if (!data) return [];
  const branches = data.branches?.branch;
  if (!branches) return [];
  const list = Array.isArray(branches) ? branches : [branches];
  return list.map((b) => b.key).filter(Boolean);
}

/**
 * Build a lookup map of releaseName → BuildInfo
 * by fetching recent results from all plans (main + branches) for a product.
 *
 * The release name is the version string set by the build (e.g. "0002.0000.0003.008978")
 * and matches the raw version string stored in api2.
 */
export async function buildReleaseNameMap(
  plans: Record<string, { project_key: string; plan_key: string }>,
  limit: number = 25,
): Promise<Map<string, BuildInfo>> {
  const map = new Map<string, BuildInfo>();

  const mainPlanKeys = Object.values(plans).map(
    (p) => `${p.project_key}-${p.plan_key}`,
  );

  // Also fetch branch plan keys so we cover branch builds
  const branchKeySets = await Promise.all(
    mainPlanKeys.map((pk) => fetchPlanBranches(pk)),
  );
  const planKeys = [...mainPlanKeys, ...branchKeySets.flat()];

  // Fetch results from all plans (main + branches) in parallel
  const allResults = await Promise.all(
    planKeys.map((pk) => fetchPlanResults(pk, limit)),
  );

  for (const results of allResults) {
    for (const r of results) {
      if (r.buildReleaseName) {
        const info = toBuildInfo(r);
        if (!map.has(r.buildReleaseName)) {
          map.set(r.buildReleaseName, info);
        }
        // Also index under the normalized form so callers requesting
        // "1.9.3.3659-mac" can resolve a Bamboo entry stored as "1.9.3.3659".
        const normalized = normalizeReleaseName(r.buildReleaseName);
        if (normalized !== r.buildReleaseName && !map.has(normalized)) {
          map.set(normalized, info);
        }
      }
    }
  }

  return map;
}

/**
 * Fetch a single build by plan key + build number, expanding variables
 * to extract inject.uaReleaseName.
 */
async function fetchBuildWithReleaseName(
  planKey: string,
  buildNumber: number,
): Promise<(BambooBuildResult & { buildReleaseName?: string }) | null> {
  const data = await bambooFetch<
    BambooBuildResult & {
      variables?: { variable?: BambooVariable | BambooVariable[] };
    }
  >(`/result/${planKey}-${buildNumber}?expand=variables`);

  if (!data) return null;

  const vars = data.variables?.variable;
  if (vars) {
    const list = Array.isArray(vars) ? vars : [vars];
    const releaseVar = list.find((v) => v.name === "inject.uaReleaseName");
    if (releaseVar) {
      data.buildReleaseName = releaseVar.value;
    }
  }
  return data;
}

/**
 * Fast lookup: find a build by release name.
 * Extracts the build number from the release name (last segment),
 * then checks each plan directly with that build number.
 * Falls back to branch plans if not found on main plans.
 */
/**
 * Normalize by stripping a trailing `-<suffix>` from the last dot-segment.
 * "1.9.3.3659-mac" -> "1.9.3.3659"
 * "1.2.3.456" -> "1.2.3.456" (unchanged)
 *
 * UA Connect uses `-mac`/`-win` platform suffixes on the build number; Bamboo
 * may store the name with or without the suffix depending on the plan setup,
 * so we compare both forms.
 */
export function normalizeReleaseName(name: string): string {
  const parts = name.split(".");
  const last = parts[parts.length - 1];
  const hyphen = last.indexOf("-");
  if (hyphen > 0) {
    parts[parts.length - 1] = last.slice(0, hyphen);
    return parts.join(".");
  }
  return name;
}

function releaseNameMatches(bambooName: string | undefined, requested: string): boolean {
  if (!bambooName) return false;
  if (bambooName === requested) return true;
  return normalizeReleaseName(bambooName) === normalizeReleaseName(requested);
}

export async function findBuildByReleaseName(
  plans: Record<string, { project_key: string; plan_key: string }>,
  releaseName: string,
): Promise<BuildInfo | null> {
  // Extract build number from release name (e.g. "1.2.9.905" → 905,
  // "1.9.3.3659-mac" → 3659).
  const parts = releaseName.split(".");
  const buildNumber = parts.length >= 4 ? parseInt(parts[parts.length - 1], 10) : NaN;
  if (isNaN(buildNumber)) return null;

  const mainPlanKeys = Object.values(plans).map(
    (p) => `${p.project_key}-${p.plan_key}`,
  );

  // Try main plans first (parallel, typically 2 calls)
  const mainResults = await Promise.all(
    mainPlanKeys.map((pk) => fetchBuildWithReleaseName(pk, buildNumber)),
  );
  for (const r of mainResults) {
    if (r && releaseNameMatches(r.buildReleaseName, releaseName)) {
      return toBuildInfo(r);
    }
  }

  // Try branch plans (fetch branch keys, then check each)
  const branchKeySets = await Promise.all(
    mainPlanKeys.map((pk) => fetchPlanBranches(pk)),
  );
  const branchKeys = branchKeySets.flat();

  const branchResults = await Promise.all(
    branchKeys.map((bk) => fetchBuildWithReleaseName(bk, buildNumber)),
  );
  for (const r of branchResults) {
    if (r && releaseNameMatches(r.buildReleaseName, releaseName)) {
      return toBuildInfo(r);
    }
  }

  return null;
}
