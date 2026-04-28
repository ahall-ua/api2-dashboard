"use client";

import { useMemo, useState, Suspense } from "react";
import { PhaseFilter } from "@/components/phase-filter";
import { PhaseMatrix } from "@/components/phase-matrix";
import { FirmwareMatrix } from "@/components/firmware-matrix";
import { displayType } from "@/lib/version-utils";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import type { MatrixRow } from "@/lib/types";

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

function DashboardInner({
  appRows,
  pluginRows,
  firmwareRows,
}: {
  appRows: MatrixRow[];
  pluginRows: MatrixRow[];
  firmwareRows: MatrixRow[];
}) {
  const [appSearch, setAppSearch] = useSearchParam("apps");
  const [pluginSearch, setPluginSearch] = useSearchParam("plugins");
  const [firmwareSearch, setFirmwareSearch] = useSearchParam("firmware");

  return (
    <PhaseFilter>
      {({ activePhases, activePlatforms, showTimestamps, devFireMs, fireMs }) => (
        <div className="space-y-8 max-w-[1600px]">
          <SearchableSection
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
          />

          <Separator />

          <SearchableSection
            title="Plugins"
            rows={pluginRows}
            kind="plugins"
            groupByType
            activePhases={activePhases}
            activePlatforms={activePlatforms}
            showTimestamps={showTimestamps}
            devFireMs={devFireMs}
            fireMs={fireMs}
            search={pluginSearch}
            onSearchChange={setPluginSearch}
          />

          {firmwareRows.length > 0 && (
            <>
              <Separator />
              <FirmwareSection
                rows={firmwareRows}
                activePhases={activePhases}
                showTimestamps={showTimestamps}
                devFireMs={devFireMs}
                fireMs={fireMs}
                search={firmwareSearch}
                onSearchChange={setFirmwareSearch}
              />
            </>
          )}
        </div>
      )}
    </PhaseFilter>
  );
}

export function DashboardContent({
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
      <DashboardInner appRows={appRows} pluginRows={pluginRows} firmwareRows={firmwareRows} />
    </Suspense>
  );
}
