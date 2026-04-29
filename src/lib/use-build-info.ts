"use client";

import { useEffect, useState } from "react";
import type { BuildInfo } from "@/lib/bamboo-api";

// Module-level promise cache shared across hook callers, so repeated
// (product, kind, release-set) lookups dedupe.
const cache = new Map<string, Promise<Record<string, BuildInfo>>>();

/**
 * Fetch build info for a product's release names from the bamboo route.
 * Returns an object keyed by release name. Loads asynchronously after mount;
 * empty object until the request resolves. Safe to call from any client
 * component — multiple components asking for the same set share one request.
 */
export function useBuildInfo(
  productName: string | undefined,
  kind: "apps" | "plugins",
  releaseNames: string[],
): Record<string, BuildInfo> {
  const [data, setData] = useState<Record<string, BuildInfo>>({});
  const key = productName && releaseNames.length > 0
    ? `${kind}:${productName}:${[...releaseNames].sort().join(",")}`
    : null;

  useEffect(() => {
    if (!key || !productName) return;
    let cancelled = false;
    let promise = cache.get(key);
    if (!promise) {
      const params = new URLSearchParams({
        product: productName,
        kind,
        releaseNames: releaseNames.join(","),
      });
      promise = fetch(`/api/bamboo/builds?${params}`)
        .then((r) => (r.ok ? r.json() : { builds: {} }))
        .then((d: { builds: Record<string, BuildInfo> }) => d.builds || {})
        .catch(() => ({} as Record<string, BuildInfo>));
      cache.set(key, promise);
    }
    promise.then((builds) => {
      if (!cancelled) setData(builds);
    });
    return () => {
      cancelled = true;
    };
  }, [key, productName, kind, releaseNames]);

  return data;
}
