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

export interface SentryLinks {
  mac?: string;
  win?: string;
}

export interface BuildInfo {
  resultKey: string;
  browseUrl: string;
  state: string;
  labels?: string[];
  sentry?: SentryLinks;
}

export function bambooBrowseUrl(buildResultKey: string): string {
  return `${BAMBOO_ROOT}/browse/${buildResultKey}`;
}

interface BambooVariable { name: string; value: string }
interface BambooLabel { name: string }
interface BambooComment { content?: string }
type BambooBuildExtras = BambooBuildResult & {
  variables?: { variable?: BambooVariable | BambooVariable[] };
  labels?: { label?: BambooLabel | BambooLabel[] };
  comments?: { comment?: BambooComment | BambooComment[] };
};

function toArray<T>(x: T | T[] | undefined): T[] {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function extractLabels(r: BambooBuildExtras): string[] {
  return toArray(r.labels?.label).map((l) => l.name).filter(Boolean);
}

/**
 * Find Sentry release URLs in build comments and bucket by platform.
 * Looks at the text surrounding each URL for "mac"/"win" markers.
 */
function extractSentry(r: BambooBuildExtras): SentryLinks | undefined {
  const comments = toArray(r.comments?.comment);
  if (comments.length === 0) return undefined;
  const text = comments.map((c) => c.content ?? "").join("\n");
  const result: SentryLinks = {};
  const re = /https:\/\/[^\s"'<>)]*sentry\.io[^\s"'<>)]*/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const url = match[0];
    const ctx = text.slice(Math.max(0, match.index - 60), match.index).toLowerCase();
    const slug = url.toLowerCase();
    const isMac = /\b(mac|osx|darwin)\b/.test(ctx) || /\b(mac|osx|darwin)\b/.test(slug);
    const isWin = /\b(win|windows|pc)\b/.test(ctx) || /\b(win|windows|pc)\b/.test(slug);
    if (isMac && !result.mac) result.mac = url;
    else if (isWin && !result.win) result.win = url;
    else if (!result.mac) result.mac = url;
    else if (!result.win) result.win = url;
  }
  return result.mac || result.win ? result : undefined;
}

function toBuildInfo(r: BambooBuildExtras): BuildInfo {
  const labels = extractLabels(r);
  const sentry = extractSentry(r);
  const info: BuildInfo = {
    resultKey: r.buildResultKey,
    browseUrl: bambooBrowseUrl(r.buildResultKey),
    state: r.buildState,
  };
  if (labels.length > 0) info.labels = labels;
  if (sentry) info.sentry = sentry;
  return info;
}

/**
 * Fetch recent build results for a plan key.
 * Expands variables to get inject.uaReleaseName for version matching.
 * Returns up to `limit` results across all states.
 */
async function fetchPlanResults(
  planKey: string,
  limit: number = 25,
): Promise<BambooBuildExtras[]> {
  const expand = [
    "results.result.variables.variable",
    "results.result.labels.label",
    "results.result.comments.comment",
  ].join(",");
  const data = await bambooFetch<{
    results?: { result?: BambooBuildExtras | BambooBuildExtras[] };
  }>(`/result/${planKey}?includeAllStates=true&max-results=${limit}&expand=${expand}`);

  if (!data) return [];
  const raw = data.results?.result;
  if (!raw) return [];
  const results = Array.isArray(raw) ? raw : [raw];

  return results.map((r) => {
    const releaseVar = toArray(r.variables?.variable).find((v) => v.name === "inject.uaReleaseName");
    if (releaseVar) r.buildReleaseName = releaseVar.value;
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
): Promise<BambooBuildExtras | null> {
  const expand = ["variables.variable", "labels.label", "comments.comment"].join(",");
  const data = await bambooFetch<BambooBuildExtras>(
    `/result/${planKey}-${buildNumber}?expand=${expand}`,
  );
  if (!data) return null;
  const releaseVar = toArray(data.variables?.variable).find((v) => v.name === "inject.uaReleaseName");
  if (releaseVar) data.buildReleaseName = releaseVar.value;
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
