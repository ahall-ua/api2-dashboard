"use client";

import { useEffect, useRef, useState } from "react";
import type { BuildInfo } from "@/lib/bamboo-api";

// Module-level promise cache shared across hook callers, so repeated
// (product, kind, release-set) lookups dedupe.
const cache = new Map<string, Promise<Record<string, BuildInfo>>>();

/**
 * Returns a ref + visibility flag. Element becomes "visible" once it scrolls
 * within `rootMargin` of the viewport, and stays visible thereafter. Used
 * to defer expensive lookups until a row/tile is actually on-screen.
 */
export function useOnVisible<T extends Element>(rootMargin = "300px"): {
  ref: React.RefObject<T | null>;
  visible: boolean;
} {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible, rootMargin]);
  return { ref, visible };
}

/**
 * Fetch build info for a product's release names from the bamboo route.
 * Returns an object keyed by release name. Loads asynchronously when the
 * `enabled` flag is true (defer until visible to avoid swarming Bamboo).
 * Multiple components asking for the same set share one request via the
 * module-level promise cache.
 */
export function useBuildInfo(
  productName: string | undefined,
  kind: "apps" | "plugins",
  releaseNames: string[],
  enabled = true,
): Record<string, BuildInfo> {
  const [data, setData] = useState<Record<string, BuildInfo>>({});
  const key = productName && releaseNames.length > 0
    ? `${kind}:${productName}:${[...releaseNames].sort().join(",")}`
    : null;

  useEffect(() => {
    if (!enabled || !key || !productName) return;
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
  }, [enabled, key, productName, kind, releaseNames]);

  return data;
}
