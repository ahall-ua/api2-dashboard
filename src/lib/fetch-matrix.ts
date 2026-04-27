import { getEnvConfig, type Api2Env } from "./api2-client";
import { mergeIntoMatrix, cascadePhases } from "./version-utils";
import type { Api2App, Api2Plugin, MatrixRow } from "./types";
import { PLATFORMS } from "./types";

const ALL_FETCH_PHASES = ["dev", "alpha", "beta", "rc", "final", "internal_dev", "internal_final", "branch", "revoke"] as const;

async function api2GetAll<T>(
  endpoint: string,
  token: string,
  params: Record<string, string>,
  env: Api2Env,
): Promise<T[]> {
  const config = getEnvConfig(env);
  const results: T[] = [];
  let page = 1;

  while (true) {
    const url = new URL(endpoint, config.baseUrl);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: token,
        "X-Api-Key": config.apiKey,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`API2 ${endpoint}: ${res.status}`);

    const data: T[] = await res.json();
    results.push(...data);

    if (data.length < 100) break;
    page++;
  }

  return results;
}

export async function fetchMatrix(
  endpoint: string,
  token: string,
  env: Api2Env,
): Promise<MatrixRow[]> {
  const matrix = new Map<number, MatrixRow>();
  const platformVariants = [...PLATFORMS, "all"] as const;

  const requests = ALL_FETCH_PHASES.flatMap((phase) =>
    platformVariants.map(async (platform) => {
      try {
        const products = await api2GetAll<Api2App | Api2Plugin>(
          endpoint,
          token,
          { version_phase: phase, version_platform: platform },
          env,
        );
        for (const product of products) {
          mergeIntoMatrix(matrix, product, phase, platform);
        }
      } catch {
        // Silently skip failed requests
      }
    }),
  );

  await Promise.all(requests);

  const rows = [...matrix.values()];
  cascadePhases(rows);

  const HIDDEN_PRODUCTS = new Set(["OX_app"]);

  return rows.filter((row) =>
    !HIDDEN_PRODUCTS.has(row.name) &&
    Object.values(row.cells).some((cell) => cell.mac || cell.win || cell.all),
  );
}
