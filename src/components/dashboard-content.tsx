"use client";

import { useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PhaseFilter } from "@/components/phase-filter";
import { PhaseMatrix } from "@/components/phase-matrix";
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

function useSearchParam(key: string): [string, (value: string) => void] {
  const router = useRouter();
  const searchParams = useSearchParams();
  const value = searchParams.get(key) || "";

  function setValue(newValue: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (newValue) {
      params.set(key, newValue);
    } else {
      params.delete(key);
    }
    const qs = params.toString();
    router.replace(window.location.pathname + (qs ? `?${qs}` : ""), { scroll: false });
  }

  return [value, setValue];
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

function DashboardInner({
  appRows,
  pluginRows,
}: {
  appRows: MatrixRow[];
  pluginRows: MatrixRow[];
}) {
  const [appSearch, setAppSearch] = useSearchParam("apps");
  const [pluginSearch, setPluginSearch] = useSearchParam("plugins");

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
        </div>
      )}
    </PhaseFilter>
  );
}

export function DashboardContent({
  appRows,
  pluginRows,
  env,
}: {
  appRows: MatrixRow[];
  pluginRows: MatrixRow[];
  env?: string;
}) {
  return (
    <Suspense>
      <DashboardInner appRows={appRows} pluginRows={pluginRows} />
    </Suspense>
  );
}
