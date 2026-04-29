"use client";

import { useRouter, useSearchParams } from "next/navigation";

// Bamboo: default ON. `bamboo=0` in the URL means user explicitly turned it off.
export function useShowBamboo(): boolean {
  return useSearchParams().get("bamboo") !== "0";
}

export function BambooToggle() {
  const router = useRouter();
  const sp = useSearchParams();
  const on = sp.get("bamboo") !== "0";
  function toggle() {
    const params = new URLSearchParams(sp.toString());
    if (on) params.set("bamboo", "0");
    else params.delete("bamboo");
    const qs = params.toString();
    router.replace(window.location.pathname + (qs ? `?${qs}` : ""), { scroll: false });
  }
  return (
    <button
      type="button"
      onClick={toggle}
      className={`px-2.5 py-0.5 text-xs rounded-md font-medium transition-colors ${
        on ? "bg-sky-600 text-sky-100" : "bg-sky-900/30 text-sky-600"
      }`}
    >
      Bamboo
    </button>
  );
}

// Sentry: default OFF. `sentry=1` in the URL means user turned it on.
// Off by default to avoid the bamboo-route fan-out when not needed.
export function useShowSentry(): boolean {
  return useSearchParams().get("sentry") === "1";
}

export function SentryToggle() {
  const router = useRouter();
  const sp = useSearchParams();
  const on = sp.get("sentry") === "1";
  function toggle() {
    const params = new URLSearchParams(sp.toString());
    if (on) params.delete("sentry");
    else params.set("sentry", "1");
    const qs = params.toString();
    router.replace(window.location.pathname + (qs ? `?${qs}` : ""), { scroll: false });
  }
  return (
    <button
      type="button"
      onClick={toggle}
      className={`px-2.5 py-0.5 text-xs rounded-md font-medium transition-colors ${
        on ? "bg-purple-600 text-purple-100" : "bg-purple-900/30 text-purple-600"
      }`}
    >
      Sentry
    </button>
  );
}
