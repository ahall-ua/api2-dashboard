export type Api2Env = "prod" | "stage";

const ENV_CONFIG: Record<Api2Env, { baseUrl: string; apiKey: string }> = {
  prod: {
    baseUrl: process.env.API2_BASE_URL || "https://api2.uaudio.com",
    apiKey: process.env.API2_API_KEY || "",
  },
  stage: {
    baseUrl: process.env.API2_STAGE_BASE_URL || "https://api2.stage.uaudio.com",
    apiKey: process.env.API2_STAGE_API_KEY || process.env.API2_API_KEY || "",
  },
};

export function getEnvConfig(env: Api2Env = "prod") {
  return ENV_CONFIG[env];
}

export class Api2Error extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "Api2Error";
  }
}

export async function api2Fetch(
  path: string,
  token: string,
  params?: Record<string, string>,
  env: Api2Env = "prod",
): Promise<Response> {
  const config = getEnvConfig(env);
  const url = new URL(path, config.baseUrl);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: token,
      "X-Api-Key": config.apiKey,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Api2Error(res.status, `API2 ${path}: ${res.status} ${res.statusText}`);
  }

  return res;
}

export async function api2FetchJson<T>(
  path: string,
  token: string,
  params?: Record<string, string>,
  env: Api2Env = "prod",
): Promise<T> {
  const res = await api2Fetch(path, token, params, env);
  return res.json() as Promise<T>;
}

import { ALL_PHASES } from "./phase-constants";
import type { Api2Version } from "./types";

/**
 * Fetch versions for a product across all phases.
 * Makes one request per phase (using the `phase` query param) to avoid
 * branch builds burying other phases in pagination.
 */
export async function fetchAllVersions(
  versionsPath: string,
  token: string,
  env: Api2Env = "prod",
): Promise<Api2Version[]> {
  const config = getEnvConfig(env);

  const results = await Promise.all(
    ALL_PHASES.map(async (phase): Promise<Api2Version[]> => {
      try {
        const url = new URL(versionsPath, config.baseUrl);
        url.searchParams.set("per_page", "100");
        url.searchParams.set("order_by", "created_at");
        url.searchParams.set("order_as", "desc");
        url.searchParams.set("phase", phase);

        const res = await fetch(url.toString(), {
          headers: {
            Authorization: token,
            "X-Api-Key": config.apiKey,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    }),
  );

  // Flatten and deduplicate by version id
  const seen = new Set<number>();
  const all: Api2Version[] = [];
  for (const versions of results) {
    for (const v of versions) {
      if (!seen.has(v.id)) {
        seen.add(v.id);
        all.push(v);
      }
    }
  }

  // Sort by deployment time, newest first
  all.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return all;
}

export async function api2Login(
  username: string,
  password: string,
  env: Api2Env = "prod",
): Promise<{ auth_token: string }> {
  const config = getEnvConfig(env);
  const url = new URL("/user/tokens", config.baseUrl);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "X-Api-Key": config.apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Api2Error(res.status, body);
  }

  return res.json();
}
