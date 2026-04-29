import type { MatrixRow } from "@/lib/types";
import { getActivePhases, groupByType } from "@/lib/version-utils";
import { Badge } from "@/components/ui/badge";
import { PHASE_COLORS } from "@/lib/phase-constants";
import { VersionCell } from "@/components/version-cell";
import { BranchTag, useShowBranches } from "@/components/branches-toggle";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function MatrixTable({
  rows,
  phases,
  kind,
  activePlatforms,
  showTimestamps,
  devFireMs,
  fireMs,
}: {
  rows: MatrixRow[];
  phases: string[];
  kind: "apps" | "plugins";
  activePlatforms: Set<string>;
  showTimestamps: boolean;
  devFireMs: number;
  fireMs: number;
}) {
  const showBranches = useShowBranches();
  return (
    <div className="border border-border/50 rounded-lg bg-card/50">
      <Table>
        <TableHeader className="sticky top-[49px] z-[5] bg-card shadow-sm">
          <TableRow className="border-border/50">
            <TableHead className="w-48">Name</TableHead>
            {phases.map((phase) => (
              <TableHead key={phase} className="text-center min-w-[160px]">
                <Badge variant="secondary" className={PHASE_COLORS[phase] || ""}>
                  {phase}
                </Badge>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="border-border/30 hover:bg-accent/50 transition-colors">
              <TableCell className="font-medium">
                <a
                  href={`/${kind}/${row.id}`}
                  className="text-primary hover:text-primary/80 hover:underline transition-colors"
                >
                  {row.description || row.name}
                </a>
                {showBranches && <BranchTag branch={row.branch} />}
                <div className="text-xs text-muted-foreground">{row.name}</div>
              </TableCell>
              {phases.map((phase) => {
                const cell = row.cells[phase];
                return (
                  <VersionCell
                    key={phase}
                    mac={activePlatforms.has("mac") ? (cell?.mac || null) : null}
                    win={activePlatforms.has("win") ? (cell?.win || null) : null}
                    all={activePlatforms.has("all") ? (cell?.all || null) : null}
                    kind={kind}
                    productId={row.id}
                    productName={row.name}
                    productType={row.type}
                    phase={phase}
                    showTimestamps={showTimestamps}
                    devFireMs={devFireMs}
                    fireMs={fireMs}
                  />
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function PhaseMatrix({
  rows,
  kind,
  groupByType: shouldGroup = false,
  activePhases,
  activePlatforms = new Set(["mac", "win"]),
  showTimestamps = false,
  devFireMs = 0,
  fireMs = 7 * 24 * 60 * 60 * 1000,
}: {
  rows: MatrixRow[];
  kind: "apps" | "plugins";
  groupByType?: boolean;
  activePhases?: Set<string>;
  activePlatforms?: Set<string>;
  showTimestamps?: boolean;
  devFireMs?: number;
  fireMs?: number;
}) {
  const allPhases = getActivePhases(rows);
  const phases = activePhases ? allPhases.filter((p) => activePhases.has(p)) : allPhases;

  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">No data available.</p>;
  }

  if (!shouldGroup) {
    const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
    return <MatrixTable rows={sorted} phases={phases} kind={kind} activePlatforms={activePlatforms} showTimestamps={showTimestamps} devFireMs={devFireMs} fireMs={fireMs} />;
  }

  const groups = groupByType(rows);

  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([type, typeRows]) => (
        <details key={type} open>
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground mb-2 select-none">
            {type}
            <span className="ml-1 text-xs">({typeRows.length})</span>
          </summary>
          <MatrixTable rows={typeRows} phases={phases} kind={kind} activePlatforms={activePlatforms} showTimestamps={showTimestamps} devFireMs={devFireMs} fireMs={fireMs} />
        </details>
      ))}
    </div>
  );
}
