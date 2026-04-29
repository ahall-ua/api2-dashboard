"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { BranchesToggle } from "@/components/branches-toggle";
import { BambooToggle, SentryToggle } from "@/components/bamboo-sentry-toggles";
import {
  ALL_PHASES, DEFAULT_ACTIVE_PHASES, PHASE_TOGGLE_COLORS,
  ALL_PLATFORMS, DEFAULT_ACTIVE_PLATFORMS, PLATFORM_TOGGLE_COLORS,
} from "@/lib/phase-constants";

export interface FilterState {
  activePhases: Set<string>;
  activePlatforms: Set<string>;
  showTimestamps: boolean;
  devFireMs: number;
  fireMs: number;
}

const FIRE_OPTIONS = [
  { label: "off", ms: 0 },
  { label: "1h", ms: 60 * 60 * 1000 },
  { label: "2h", ms: 2 * 60 * 60 * 1000 },
  { label: "6h", ms: 6 * 60 * 60 * 1000 },
  { label: "1d", ms: 24 * 60 * 60 * 1000 },
  { label: "3d", ms: 3 * 24 * 60 * 60 * 1000 },
  { label: "1w", ms: 7 * 24 * 60 * 60 * 1000 },
  { label: "2w", ms: 14 * 24 * 60 * 60 * 1000 },
  { label: "1mo", ms: 30 * 24 * 60 * 60 * 1000 },
];

const DEFAULT_DEV_FIRE = "off";
const DEFAULT_FIRE = "1w";

function msToLabel(ms: number): string {
  return FIRE_OPTIONS.find((o) => o.ms === ms)?.label || "off";
}

function labelToMs(label: string): number {
  return FIRE_OPTIONS.find((o) => o.label === label)?.ms || 0;
}

function FireSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (ms: number) => void;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      <select
        value={msToLabel(value)}
        onChange={(e) => onChange(labelToMs(e.target.value))}
        className="bg-secondary text-secondary-foreground text-xs rounded px-1.5 py-0.5 cursor-pointer border border-border/50"
      >
        {FIRE_OPTIONS.map((o) => (
          <option key={o.label} value={o.label}>{o.label}</option>
        ))}
      </select>
    </span>
  );
}

function parseSet(param: string | null, allValues: string[], defaults: Set<string>): Set<string> {
  if (!param) return new Set(defaults);
  const values = param.split(",").filter((v) => allValues.includes(v));
  return new Set(values.length > 0 ? values : defaults);
}

function ToggleSet({
  label,
  items,
  active,
  colors,
  onToggle,
}: {
  label: string;
  items: string[];
  active: Set<string>;
  colors: Record<string, { on: string; off: string }>;
  onToggle: (item: string) => void;
}) {
  return (
    <>
      <span className="text-xs text-muted-foreground mr-1 uppercase tracking-wider">{label}</span>
      {items.map((item) => {
        const isOn = active.has(item);
        const c = colors[item] || { on: "", off: "" };
        return (
          <button key={item} onClick={() => onToggle(item)}>
            <Badge
              variant="secondary"
              className={`cursor-pointer select-none transition-all ${isOn ? c.on : c.off} ${isOn ? "shadow-sm" : "opacity-60"}`}
            >
              {item}
            </Badge>
          </button>
        );
      })}
    </>
  );
}

export function PhaseFilter({
  children,
  showTimestampsOption = true,
  showBranchesOption = true,
}: {
  children: (state: FilterState) => React.ReactNode;
  showTimestampsOption?: boolean;
  showBranchesOption?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activePhases, setActivePhases] = useState<Set<string>>(
    () => parseSet(searchParams.get("phases"), ALL_PHASES, DEFAULT_ACTIVE_PHASES),
  );
  const [activePlatforms, setActivePlatforms] = useState<Set<string>>(
    () => parseSet(searchParams.get("platforms"), ALL_PLATFORMS, DEFAULT_ACTIVE_PLATFORMS),
  );
  const [showTimestamps, setShowTimestamps] = useState(
    () => searchParams.get("timestamps") === "1",
  );
  const [devFireMs, setDevFireMs] = useState(
    () => labelToMs(searchParams.get("dev_fire") || DEFAULT_DEV_FIRE),
  );
  const [fireMs, setFireMs] = useState(
    () => labelToMs(searchParams.get("fire") || DEFAULT_FIRE),
  );

  const syncUrl = useCallback((
    phases: Set<string>,
    platforms: Set<string>,
    timestamps: boolean,
    devFire: number,
    fire: number,
  ) => {
    // Start from the existing URL so params managed by other components
    // (search, kind filter, etc.) survive — only overwrite/delete the keys
    // this filter is responsible for.
    const params = new URLSearchParams(searchParams.toString());

    function setOrDelete(key: string, value: string, isDefault: boolean) {
      if (isDefault) params.delete(key);
      else params.set(key, value);
    }

    const phasesStr = [...phases].sort().join(",");
    const defaultPhasesStr = [...DEFAULT_ACTIVE_PHASES].sort().join(",");
    setOrDelete("phases", phasesStr, phasesStr === defaultPhasesStr);

    const platformsStr = [...platforms].sort().join(",");
    const defaultPlatformsStr = [...DEFAULT_ACTIVE_PLATFORMS].sort().join(",");
    setOrDelete("platforms", platformsStr, platformsStr === defaultPlatformsStr);

    setOrDelete("timestamps", "1", !timestamps);

    const devFireLabel = msToLabel(devFire);
    setOrDelete("dev_fire", devFireLabel, devFireLabel === DEFAULT_DEV_FIRE);

    const fireLabel = msToLabel(fire);
    setOrDelete("fire", fireLabel, fireLabel === DEFAULT_FIRE);

    const qs = params.toString();
    const newUrl = window.location.pathname + (qs ? `?${qs}` : "");
    router.replace(newUrl, { scroll: false });
  }, [router, searchParams]);

  function togglePhase(item: string) {
    const next = new Set(activePhases);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    setActivePhases(next);
    syncUrl(next, activePlatforms, showTimestamps, devFireMs, fireMs);
  }

  function togglePlatform(item: string) {
    const next = new Set(activePlatforms);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    setActivePlatforms(next);
    syncUrl(activePhases, next, showTimestamps, devFireMs, fireMs);
  }

  function handleToggleTimestamps() {
    const next = !showTimestamps;
    setShowTimestamps(next);
    syncUrl(activePhases, activePlatforms, next, devFireMs, fireMs);
  }

  function handleDevFireChange(ms: number) {
    setDevFireMs(ms);
    syncUrl(activePhases, activePlatforms, showTimestamps, ms, fireMs);
  }

  function handleFireChange(ms: number) {
    setFireMs(ms);
    syncUrl(activePhases, activePlatforms, showTimestamps, devFireMs, ms);
  }

  return (
    <div>
      {/* Row 1: phases (left) | options (right) */}
      <div className="flex gap-2 mb-2 flex-wrap items-center">
        <ToggleSet
          label="Phases"
          items={ALL_PHASES}
          active={activePhases}
          colors={PHASE_TOGGLE_COLORS}
          onToggle={togglePhase}
        />
        <div className="flex gap-2 flex-wrap items-center ml-auto">
          <span className="text-xs text-muted-foreground mr-1 uppercase tracking-wider">Options</span>
          {showBranchesOption && <BranchesToggle />}
          <BambooToggle />
          <SentryToggle />
          {showTimestampsOption && (
            <button onClick={handleToggleTimestamps}>
              <Badge
                variant="secondary"
                className={`cursor-pointer select-none transition-all ${
                  showTimestamps
                    ? "bg-zinc-600 text-zinc-100 shadow-sm"
                    : "bg-zinc-800/50 text-zinc-500 opacity-60"
                }`}
              >
                timestamps
              </Badge>
            </button>
          )}
        </div>
      </div>

      {/* Row 2: platforms (left) | fire selectors (right) */}
      <div className="flex gap-2 mb-6 flex-wrap items-center">
        <ToggleSet
          label="Platforms"
          items={ALL_PLATFORMS}
          active={activePlatforms}
          colors={PLATFORM_TOGGLE_COLORS}
          onToggle={togglePlatform}
        />
        <div className="flex gap-2 flex-wrap items-center ml-auto">
          <span className="text-xs text-muted-foreground mr-1 uppercase tracking-wider">🔥</span>
          <FireSelect label="dev" value={devFireMs} onChange={handleDevFireChange} />
          <FireSelect label="other" value={fireMs} onChange={handleFireChange} />
        </div>
      </div>

      {children({ activePhases, activePlatforms, showTimestamps, devFireMs, fireMs })}
    </div>
  );
}
