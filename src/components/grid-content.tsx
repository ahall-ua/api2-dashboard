"use client";

import { useMemo, useState, useEffect, useRef, useCallback, Suspense } from "react";
import { PhaseFilter } from "@/components/phase-filter";
import { PhaseMatrix } from "@/components/phase-matrix";
import { FirmwareMatrix } from "@/components/firmware-matrix";
import { ShowFilter, useActiveShow } from "@/components/show-filter";
import { displayType } from "@/lib/version-utils";
import { DEFAULT_FETCH_PHASES } from "@/lib/phase-constants";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import type { MatrixRow } from "@/lib/types";

function mergePhaseIntoRows(existing: MatrixRow[], incoming: MatrixRow[], phase: string): MatrixRow[] {
  const byId = new Map(existing.map((r) => [r.id, r]));
  for (const newRow of incoming) {
    const cur = byId.get(newRow.id);
    if (!cur) {
      byId.set(newRow.id, newRow);
      continue;
    }
    const merged: MatrixRow = {
      ...cur,
      cells: { ...cur.cells, ...(newRow.cells[phase] ? { [phase]: newRow.cells[phase] } : {}) },
      firmwareCells: { ...cur.firmwareCells, ...(newRow.firmwareCells[phase] ? { [phase]: newRow.firmwareCells[phase] } : {}) },
    };
    byId.set(newRow.id, merged);
  }
  return [...byId.values()];
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

// Keep search state local — pushing to the URL re-runs the dashboard
// server component and refetches the entire matrix on every keystroke.
function useSearchParam(_key: string): [string, (value: string) => void] {
  return useState("");
}

function SearchableSection({
  title,
  rows,
  kind,
  groupByType,
  activePhases,
  activePlatforms,
  showTimestamps,
  devFireMs,
  fireMs,
  search,
  onSearchChange,
}: {
  title: string;
  rows: MatrixRow[];
  kind: "apps" | "plugins";
  groupByType?: boolean;
  activePhases: Set<string>;
  activePlatforms: Set<string>;
  showTimestamps: boolean;
  devFireMs: number;
  fireMs: number;
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const filtered = useMemo(() => filterRows(rows, search), [rows, search]);

  return (
    <details open>
      <summary className="cursor-pointer text-xl font-semibold mb-4 select-none">
        {title}
        <span className="text-sm font-normal text-muted-foreground ml-2">
          ({filtered.length}{search ? ` / ${rows.length}` : ""})
        </span>
      </summary>
      <Input
        placeholder={`Search ${title.toLowerCase()}...`}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="max-w-xs mb-4"
      />
      <PhaseMatrix
        rows={filtered}
        kind={kind}
        groupByType={groupByType}
        activePhases={activePhases}
        activePlatforms={activePlatforms}
        showTimestamps={showTimestamps}
        devFireMs={devFireMs}
        fireMs={fireMs}
      />
    </details>
  );
}

function FirmwareSection({
  rows,
  activePhases,
  showTimestamps,
  devFireMs,
  fireMs,
  search,
  onSearchChange,
}: {
  rows: MatrixRow[];
  activePhases: Set<string>;
  showTimestamps: boolean;
  devFireMs: number;
  fireMs: number;
  search: string;
  onSearchChange: (v: string) => void;
}) {
  const filtered = useMemo(() => filterRows(rows, search), [rows, search]);
  return (
    <details open>
      <summary className="cursor-pointer text-xl font-semibold mb-4 select-none">
        Firmware
        <span className="text-sm font-normal text-muted-foreground ml-2">
          ({filtered.length}{search ? ` / ${rows.length}` : ""})
        </span>
      </summary>
      <Input
        placeholder="Search firmware..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="max-w-xs mb-4"
      />
      <FirmwareMatrix
        rows={filtered}
        activePhases={activePhases}
        showTimestamps={showTimestamps}
        devFireMs={devFireMs}
        fireMs={fireMs}
      />
    </details>
  );
}

function DashboardBody({
  activePhases,
  activePlatforms,
  showTimestamps,
  devFireMs,
  fireMs,
  appRows,
  pluginRows,
  firmwareRows,
  appSearch,
  setAppSearch,
  pluginSearch,
  setPluginSearch,
  firmwareSearch,
  setFirmwareSearch,
  onPhaseLoaded,
}: {
  activePhases: Set<string>;
  activePlatforms: Set<string>;
  showTimestamps: boolean;
  devFireMs: number;
  fireMs: number;
  appRows: MatrixRow[];
  pluginRows: MatrixRow[];
  firmwareRows: MatrixRow[];
  appSearch: string;
  setAppSearch: (v: string) => void;
  pluginSearch: string;
  setPluginSearch: (v: string) => void;
  firmwareSearch: string;
  setFirmwareSearch: (v: string) => void;
  onPhaseLoaded: (phase: string, data: { appRows: MatrixRow[]; pluginRows: MatrixRow[]; firmwareRows: MatrixRow[] }) => void;
}) {
  const loadedPhasesRef = useRef(new Set(DEFAULT_FETCH_PHASES));
  const inFlightRef = useRef(new Set<string>());

  useEffect(() => {
    for (const phase of activePhases) {
      if (loadedPhasesRef.current.has(phase) || inFlightRef.current.has(phase)) continue;
      inFlightRef.current.add(phase);
      fetch(`/api/matrix-phase?phase=${encodeURIComponent(phase)}`)
        .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
        .then((data: { phase: string; appRows: MatrixRow[]; pluginRows: MatrixRow[]; firmwareRows: MatrixRow[] }) => {
          loadedPhasesRef.current.add(data.phase);
          onPhaseLoaded(data.phase, data);
        })
        .catch((err) => console.warn(`Failed to load phase ${phase}:`, err))
        .finally(() => inFlightRef.current.delete(phase));
    }
  }, [activePhases, onPhaseLoaded]);

  const available = ["apps", "uadx", "uadx-luna", "uad2", "external", "content", "plugins-other", "firmware"] as const;
  const active = useActiveShow(available);

  const KNOWN_PLUGIN_TYPES = new Set(["uadx", "uadx-luna", "uad2", "external", "content"]);
  const visiblePluginRows = pluginRows.filter((r) => {
    const t = displayType(r.type);
    if (KNOWN_PLUGIN_TYPES.has(t)) return active.has(t);
    return active.has("plugins-other");
  });
  const showPlugins = visiblePluginRows.length > 0;

  const sections: React.ReactNode[] = [];
  if (active.has("apps")) {
    sections.push(
      <SearchableSection
        key="apps"
        title="Apps"
        rows={appRows}
        kind="apps"
        activePhases={activePhases}
        activePlatforms={activePlatforms}
        showTimestamps={showTimestamps}
        devFireMs={devFireMs}
        fireMs={fireMs}
        search={appSearch}
        onSearchChange={setAppSearch}
      />,
    );
  }
  if (showPlugins) {
    sections.push(
      <SearchableSection
        key="plugins"
        title="Plugins"
        rows={visiblePluginRows}
        kind="plugins"
        groupByType
        activePhases={activePhases}
        activePlatforms={activePlatforms}
        showTimestamps={showTimestamps}
        devFireMs={devFireMs}
        fireMs={fireMs}
        search={pluginSearch}
        onSearchChange={setPluginSearch}
      />,
    );
  }
  if (active.has("firmware") && firmwareRows.length > 0) {
    sections.push(
      <FirmwareSection
        key="firmware"
        rows={firmwareRows}
        activePhases={activePhases}
        showTimestamps={showTimestamps}
        devFireMs={devFireMs}
        fireMs={fireMs}
        search={firmwareSearch}
        onSearchChange={setFirmwareSearch}
      />,
    );
  }

  return (
    <div className="space-y-8 max-w-[1600px]">
      <ShowFilter available={available} />
      {sections.map((s, i) => (
        <div key={i}>
          {i > 0 && <Separator className="mb-8" />}
          {s}
        </div>
      ))}
    </div>
  );
}

function GridInner({
  appRows: initialAppRows,
  pluginRows: initialPluginRows,
  firmwareRows: initialFirmwareRows,
}: {
  appRows: MatrixRow[];
  pluginRows: MatrixRow[];
  firmwareRows: MatrixRow[];
}) {
  const [appSearch, setAppSearch] = useSearchParam("apps");
  const [pluginSearch, setPluginSearch] = useSearchParam("plugins");
  const [firmwareSearch, setFirmwareSearch] = useSearchParam("firmware");

  const [appRows, setAppRows] = useState(initialAppRows);
  const [pluginRows, setPluginRows] = useState(initialPluginRows);
  const [firmwareRows, setFirmwareRows] = useState(initialFirmwareRows);

  const handlePhaseLoaded = useCallback(
    (phase: string, data: { appRows: MatrixRow[]; pluginRows: MatrixRow[]; firmwareRows: MatrixRow[] }) => {
      setAppRows((rows) => mergePhaseIntoRows(rows, data.appRows, phase));
      setPluginRows((rows) => mergePhaseIntoRows(rows, data.pluginRows, phase));
      setFirmwareRows((rows) => mergePhaseIntoRows(rows, data.firmwareRows, phase));
    },
    [],
  );

  return (
    <PhaseFilter>
      {({ activePhases, activePlatforms, showTimestamps, devFireMs, fireMs }) => (
        <DashboardBody
          activePhases={activePhases}
          activePlatforms={activePlatforms}
          showTimestamps={showTimestamps}
          devFireMs={devFireMs}
          fireMs={fireMs}
          appRows={appRows}
          pluginRows={pluginRows}
          firmwareRows={firmwareRows}
          appSearch={appSearch}
          setAppSearch={setAppSearch}
          pluginSearch={pluginSearch}
          setPluginSearch={setPluginSearch}
          firmwareSearch={firmwareSearch}
          setFirmwareSearch={setFirmwareSearch}
          onPhaseLoaded={handlePhaseLoaded}
        />
      )}
    </PhaseFilter>
  );
}

export function GridContent({
  appRows,
  pluginRows,
  firmwareRows,
  env,
}: {
  appRows: MatrixRow[];
  pluginRows: MatrixRow[];
  firmwareRows: MatrixRow[];
  env?: string;
}) {
  return (
    <Suspense>
      <GridInner appRows={appRows} pluginRows={pluginRows} firmwareRows={firmwareRows} />
    </Suspense>
  );
}
