"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { displayType, groupByType, getBestVersionForAccessLevel } from "@/lib/version-utils";
import { ShowFilter, useActiveShow } from "@/components/show-filter";
import { getDeepLinkConfig, makeArchiveUrl } from "@/lib/deep-links";
import { ExternalLink } from "lucide-react";
import { BranchesToggle, BranchTag, useShowBranches } from "@/components/branches-toggle";
import {
  PLATFORM_COLORS,
  ALL_PLATFORMS, PLATFORM_TOGGLE_COLORS,
  DEFAULT_FETCH_PHASES, PHASE_TOGGLE_COLORS,
} from "@/lib/phase-constants";
import type { MatrixRow, VersionSummary } from "@/lib/types";

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

function msToLabel(ms: number): string {
  return FIRE_OPTIONS.find((o) => o.ms === ms)?.label || "off";
}
function labelToMs(label: string): number {
  return FIRE_OPTIONS.find((o) => o.label === label)?.ms || 0;
}

const DEV_PHASES = new Set(["dev", "branch", "internal_dev"]);

function shouldShowFire(phase: string, createdAt: string, devFireMs: number, fireMs: number): boolean {
  const isDev = DEV_PHASES.has(phase);
  const thresholdMs = isDev ? devFireMs : fireMs;
  if (thresholdMs === 0) return false;
  return Date.now() - new Date(createdAt).getTime() < thresholdMs;
}

const TYPE_BORDER_COLORS: Record<string, string> = {
  uadx:           "border-l-indigo-500",
  "uadx-luna":    "border-l-blue-500",
  uad2:           "border-l-orange-500",
  luna_app:       "border-l-cyan-500",
  unified_app:    "border-l-emerald-500",
  uafx_firmware:  "border-l-pink-500",
  volt_firmware:  "border-l-yellow-500",
  uafx_app:       "border-l-pink-400",
  volt_app:       "border-l-yellow-400",
};

function getTypeBorderColor(type: string): string {
  const dt = displayType(type);
  return TYPE_BORDER_COLORS[dt] || TYPE_BORDER_COLORS[type] || "border-l-zinc-500";
}

function bambooBuildRedirectUrl(
  kind: string,
  productName: string,
  displayVersion: string,
): string {
  const params = new URLSearchParams({
    product: productName,
    kind,
    releaseName: displayVersion,
    fallback: "/dashboard",
  });
  return `/api/bamboo/redirect?${params}`;
}

// Product types that don't have Bamboo plans in the manifest.
const NO_BAMBOO_TYPES = new Set(["lunacomponent_with_wrappers", "lunacomponent"]);

function VersionLine({ v, phase, kind, productId, productName, productType, devFireMs, fireMs }: { v: VersionSummary; phase: string; kind: "apps" | "plugins"; productId: number; productName: string; productType: string; devFireMs: number; fireMs: number }) {
  const platformColor = PLATFORM_COLORS[v.platform] || "";
  const hasBamboo = !NO_BAMBOO_TYPES.has(productType);
  const bambooUrl = hasBamboo ? bambooBuildRedirectUrl(kind, productName, v.version) : null;
  const detailUrl = `/${kind}/${productId}#v-${v.versionId}`;
  const deepLink = getDeepLinkConfig(kind, productName, productType);
  const isUaConnect = productName === "UA_Connect";

  async function handleApi2Download(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const res = await fetch(`/api/proxy/${kind}/${productId}/versions/${v.versionId}`);
    if (!res.ok) return;
    const data = await res.json();
    const url = data.private_install_url || data.install_url;
    if (url) window.open(url, "_blank");
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <a href={detailUrl} className="font-mono text-blue-600 dark:text-blue-400 hover:underline">
        {v.version}
      </a>
      <span className={`${platformColor} font-medium text-xs`}>{v.platform}</span>
      {bambooUrl && (
        <a
          href={bambooUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open Bamboo build"
          className="inline-flex text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
      {isUaConnect ? (
        <a
          href="#"
          title="Download installer from API2"
          onClick={handleApi2Download}
          className="inline-flex text-sky-400 hover:text-sky-300 transition-colors"
        >
          ↓
        </a>
      ) : deepLink?.archiveName ? (
        <a
          href={makeArchiveUrl(deepLink, v.version)}
          title="Download via UA Connect"
          className="inline-flex text-emerald-400 hover:text-emerald-300 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          ↓
        </a>
      ) : null}
      {shouldShowFire(phase, v.createdAt, devFireMs, fireMs) && <span title="Recent deploy">🔥</span>}
    </div>
  );
}

function MonitorCard({
  row,
  kind,
  phase,
  platforms,
  devFireMs,
  fireMs,
}: {
  row: MatrixRow;
  kind: "apps" | "plugins";
  phase: string;
  platforms: Set<string>;
  devFireMs: number;
  fireMs: number;
}) {
  const showBranches = useShowBranches();
  const showMac = platforms.has("mac") || platforms.has("all");
  const showWin = platforms.has("win") || platforms.has("all");
  const all = getBestVersionForAccessLevel(row, phase, "all");
  const mac = !all && showMac ? getBestVersionForAccessLevel(row, phase, "mac") : null;
  const win = !all && showWin ? getBestVersionForAccessLevel(row, phase, "win") : null;
  if (!mac && !win && !all) return null;

  const borderColor = getTypeBorderColor(row.type);

  return (
    <div className={`border border-border/50 border-l-4 ${borderColor} rounded-lg bg-card/70 p-4 flex flex-col gap-2 hover:bg-card transition-colors`}>
      <div>
        <a href={`/${kind}/${row.id}`} className="font-semibold text-foreground text-sm leading-tight hover:underline">
          {row.description || row.name}
        </a>
        {row.bambooPlanUrl && (
          <a
            href={row.bambooPlanUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open Bamboo plan"
            className="inline-flex ml-1.5 text-muted-foreground hover:text-foreground transition-colors align-middle"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {showBranches && <BranchTag branch={row.branch} />}
        <div className="text-xs text-muted-foreground">{row.name}</div>
      </div>
      <div className="space-y-1">
        {all && <VersionLine v={all} phase={phase} kind={kind} productId={row.id} productName={row.name} productType={row.type} devFireMs={devFireMs} fireMs={fireMs} />}
        {mac && <VersionLine v={mac} phase={phase} kind={kind} productId={row.id} productName={row.name} productType={row.type} devFireMs={devFireMs} fireMs={fireMs} />}
        {win && <VersionLine v={win} phase={phase} kind={kind} productId={row.id} productName={row.name} productType={row.type} devFireMs={devFireMs} fireMs={fireMs} />}
      </div>
    </div>
  );
}

function filterRows(rows: MatrixRow[], query: string): MatrixRow[] {
  if (!query) return rows;
  const q = query.toLowerCase();
  return rows.filter(
    (r) =>
      r.name.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.type.toLowerCase().includes(q) ||
      displayType(r.type).toLowerCase().includes(q),
  );
}

function hasPhaseData(row: MatrixRow, phase: string, platforms: Set<string>): boolean {
  const showMac = platforms.has("mac") || platforms.has("all");
  const showWin = platforms.has("win") || platforms.has("all");
  const all = getBestVersionForAccessLevel(row, phase, "all");
  const mac = showMac ? getBestVersionForAccessLevel(row, phase, "mac") : null;
  const win = showWin ? getBestVersionForAccessLevel(row, phase, "win") : null;
  return !!(mac || win || all);
}

function MonitorCardGrid({
  rows,
  kind,
  phase,
  platforms,
  devFireMs,
  fireMs,
}: {
  rows: MatrixRow[];
  kind: "apps" | "plugins";
  phase: string;
  platforms: Set<string>;
  devFireMs: number;
  fireMs: number;
}) {
  if (rows.length === 0) return null;

  const sorted = [...rows].sort((a, b) => (a.description || a.name).localeCompare(b.description || b.name));

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
      {sorted.map((row) => (
        <MonitorCard key={row.id} row={row} kind={kind} phase={phase} platforms={platforms} devFireMs={devFireMs} fireMs={fireMs} />
      ))}
    </div>
  );
}

function SearchableMonitorSection({
  title,
  rows,
  kind,
  phase,
  platforms,
  groupByTypeFlag,
  devFireMs,
  fireMs,
  search,
  onSearchChange,
}: {
  title: string;
  rows: MatrixRow[];
  kind: "apps" | "plugins";
  phase: string;
  platforms: Set<string>;
  groupByTypeFlag?: boolean;
  devFireMs: number;
  fireMs: number;
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const visible = useMemo(
    () => filterRows(rows, search).filter((r) => hasPhaseData(r, phase, platforms)),
    [rows, search, phase, platforms],
  );

  return (
    <details open>
      <summary className="cursor-pointer text-xl font-semibold mb-4 select-none">
        {title}
        <span className="text-sm font-normal text-muted-foreground ml-2">
          ({visible.length}{search ? ` / ${rows.length}` : ""})
        </span>
      </summary>
      <Input
        placeholder={`Search ${title.toLowerCase()}...`}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="max-w-xs mb-4"
      />
      {!groupByTypeFlag ? (
        <MonitorCardGrid rows={visible} kind={kind} phase={phase} platforms={platforms} devFireMs={devFireMs} fireMs={fireMs} />
      ) : (
        <div className="space-y-4">
          {[...groupByType(visible).entries()].map(([type, typeRows]) => {
            const typeVisible = typeRows.filter((r) => hasPhaseData(r, phase, platforms));
            if (typeVisible.length === 0) return null;
            return (
              <details key={type} open>
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground mb-2 select-none">
                  {type}
                  <span className="ml-1 text-xs">({typeVisible.length})</span>
                </summary>
                <MonitorCardGrid rows={typeVisible} kind={kind} phase={phase} platforms={platforms} devFireMs={devFireMs} fireMs={fireMs} />
              </details>
            );
          })}
        </div>
      )}
      {visible.length === 0 && (
        <p className="text-muted-foreground text-sm py-8 text-center">
          No products match
        </p>
      )}
    </details>
  );
}

function DashboardInner({ appRows, pluginRows }: { appRows: MatrixRow[]; pluginRows: MatrixRow[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showAvailable = ["apps", "uadx", "uadx-luna", "uad2", "external", "plugins-other"] as const;
  const activeShow = useActiveShow(showAvailable);

  const KNOWN_PLUGIN_TYPES = new Set(["uadx", "uadx-luna", "uad2", "external"]);
  const visiblePluginRows = pluginRows.filter((r) => {
    const t = displayType(r.type);
    if (KNOWN_PLUGIN_TYPES.has(t)) return activeShow.has(t);
    return activeShow.has("plugins-other");
  });
  const showApps = activeShow.has("apps");
  const showPlugins = visiblePluginRows.length > 0;

  const phase = searchParams.get("phase") || "final";
  const platformsParam = searchParams.get("platforms");
  const [platforms, setPlatforms] = useState<Set<string>>(
    () => platformsParam ? new Set(platformsParam.split(",")) : new Set(["mac", "win", "all"]),
  );

  const [appSearch, setAppSearch] = useState(searchParams.get("apps") || "");
  const [pluginSearch, setPluginSearch] = useState(searchParams.get("plugins") || "");
  const [devFireMs, setDevFireMs] = useState(() => labelToMs(searchParams.get("dev_fire") || "off"));
  const [fireMs, setFireMs] = useState(() => labelToMs(searchParams.get("fire") || "1w"));

  function togglePlatform(p: string) {
    const next = new Set(platforms);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    setPlatforms(next);

    const params = new URLSearchParams(searchParams.toString());
    const sorted = [...next].sort().join(",");
    if (sorted === "all,mac,win") {
      params.delete("platforms");
    } else {
      params.set("platforms", sorted);
    }
    const qs = params.toString();
    router.replace(window.location.pathname + (qs ? `?${qs}` : ""), { scroll: false });
  }

  function selectPhase(p: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (p === "final") params.delete("phase");
    else params.set("phase", p);
    const qs = params.toString();
    router.replace(window.location.pathname + (qs ? `?${qs}` : ""), { scroll: false });
  }

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [router]);

  return (
    <div className="p-6 max-w-[1600px]">
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <span className="text-xs text-muted-foreground mr-1 uppercase tracking-wider">Phase</span>
        <div className="flex items-center gap-1.5">
          {DEFAULT_FETCH_PHASES.map((p) => {
            const isOn = p === phase;
            const c = PHASE_TOGGLE_COLORS[p] || { on: "", off: "" };
            return (
              <button key={p} onClick={() => selectPhase(p)}>
                <Badge
                  variant="secondary"
                  className={`cursor-pointer select-none transition-all px-3 py-1 ${isOn ? c.on : c.off} ${isOn ? "shadow-sm text-base" : "opacity-60"}`}
                >
                  {p}
                </Badge>
              </button>
            );
          })}
        </div>

        <span className="text-xs text-muted-foreground ml-4 mr-1 uppercase tracking-wider">Platforms</span>
        {ALL_PLATFORMS.map((p) => {
          const isOn = platforms.has(p);
          const c = PLATFORM_TOGGLE_COLORS[p] || { on: "", off: "" };
          return (
            <button key={p} onClick={() => togglePlatform(p)}>
              <Badge
                variant="secondary"
                className={`cursor-pointer select-none transition-all ${isOn ? c.on : c.off} ${isOn ? "shadow-sm" : "opacity-60"}`}
              >
                {p}
              </Badge>
            </button>
          );
        })}

        <span className="text-xs text-muted-foreground ml-4 mr-1 uppercase tracking-wider">🔥</span>
        <span className="inline-flex items-center gap-1">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">dev</span>
          <select
            value={msToLabel(devFireMs)}
            onChange={(e) => setDevFireMs(labelToMs(e.target.value))}
            className="bg-secondary text-secondary-foreground text-xs rounded px-1.5 py-0.5 cursor-pointer border border-border/50"
          >
            {FIRE_OPTIONS.map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}
          </select>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">other</span>
          <select
            value={msToLabel(fireMs)}
            onChange={(e) => setFireMs(labelToMs(e.target.value))}
            className="bg-secondary text-secondary-foreground text-xs rounded px-1.5 py-0.5 cursor-pointer border border-border/50"
          >
            {FIRE_OPTIONS.map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}
          </select>
        </span>
      </div>

      <div className="mb-4 flex items-center gap-4 flex-wrap">
        <ShowFilter available={showAvailable} />
        <BranchesToggle />
      </div>

      <div className="space-y-8">
        {showApps && (
          <SearchableMonitorSection
            title="Apps"
            rows={appRows}
            kind="apps"
            phase={phase}
            platforms={platforms}
            devFireMs={devFireMs}
            fireMs={fireMs}
            search={appSearch}
            onSearchChange={setAppSearch}
          />
        )}

        {showApps && showPlugins && <Separator />}

        {showPlugins && (
          <SearchableMonitorSection
            title="Plugins"
            rows={visiblePluginRows}
            kind="plugins"
            phase={phase}
            platforms={platforms}
            groupByTypeFlag
            devFireMs={devFireMs}
            fireMs={fireMs}
            search={pluginSearch}
            onSearchChange={setPluginSearch}
          />
        )}
      </div>
    </div>
  );
}

export function DashboardView({
  appRows,
  pluginRows,
}: {
  appRows: MatrixRow[];
  pluginRows: MatrixRow[];
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground text-sm">Loading dashboard...</div>
      </div>
    );
  }

  return <DashboardInner appRows={appRows} pluginRows={pluginRows} />;
}
