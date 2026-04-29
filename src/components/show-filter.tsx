"use client";

import { useRouter, useSearchParams } from "next/navigation";

export interface ShowOption {
  key: string;
  label: string;
  on: string;
  off: string;
}

const COLORS = {
  emerald: { on: "bg-emerald-600 text-emerald-100", off: "bg-emerald-900/30 text-emerald-600" },
  sky:     { on: "bg-sky-600 text-sky-100",          off: "bg-sky-900/30 text-sky-600" },
  violet:  { on: "bg-violet-600 text-violet-100",    off: "bg-violet-900/30 text-violet-600" },
  amber:   { on: "bg-amber-600 text-amber-100",      off: "bg-amber-900/30 text-amber-600" },
  pink:    { on: "bg-pink-600 text-pink-100",        off: "bg-pink-900/30 text-pink-600" },
  rose:    { on: "bg-rose-600 text-rose-100",        off: "bg-rose-900/30 text-rose-600" },
  zinc:    { on: "bg-zinc-600 text-zinc-100",        off: "bg-zinc-800/50 text-zinc-500" },
};

export const SHOW_OPTIONS: Record<string, ShowOption> = {
  apps:           { key: "apps",          label: "Apps",       ...COLORS.emerald },
  uadx:           { key: "uadx",          label: "uadx",       ...COLORS.sky },
  "uadx-luna":    { key: "uadx-luna",     label: "uadx-luna",  ...COLORS.violet },
  uad2:           { key: "uad2",          label: "uad2",       ...COLORS.amber },
  external:       { key: "external",      label: "external",   ...COLORS.rose },
  "plugins-other":{ key: "plugins-other", label: "other",      ...COLORS.zinc },
  firmware:       { key: "firmware",      label: "Firmware",   ...COLORS.pink },
};

import { parseShow } from "@/lib/show-filter-parsing";

export function useActiveShow(available: readonly string[]): Set<string> {
  const searchParams = useSearchParams();
  return parseShow(searchParams.get("show"), available);
}

export function ShowFilter({ available }: { available: readonly string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = parseShow(searchParams.get("show"), available);

  function toggle(key: string) {
    const next = new Set(active);
    if (next.has(key)) next.delete(key);
    else next.add(key);

    const params = new URLSearchParams(searchParams.toString());
    const allOn = available.every((k) => next.has(k));
    if (next.size === 0 || allOn) {
      params.delete("show");
    } else {
      // Preserve declaration order so the URL is stable / predictable.
      params.set("show", available.filter((k) => next.has(k)).join(","));
    }
    const qs = params.toString();
    router.replace(window.location.pathname + (qs ? `?${qs}` : ""), { scroll: false });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">Show</span>
      {available.map((k) => {
        const opt = SHOW_OPTIONS[k];
        if (!opt) return null;
        const on = active.has(k);
        return (
          <button
            key={k}
            type="button"
            onClick={() => toggle(k)}
            className={`px-2.5 py-0.5 text-xs rounded-md font-medium transition-colors ${on ? opt.on : opt.off}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
