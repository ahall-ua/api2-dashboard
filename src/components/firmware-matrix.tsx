import type { MatrixRow, VersionSummary } from "@/lib/types";
import { getActivePhases } from "@/lib/version-utils";
import { formatTimestamp } from "@/lib/version-utils";
import { Badge } from "@/components/ui/badge";
import { PHASE_COLORS } from "@/lib/phase-constants";
import { BranchTag, useShowBranches } from "@/components/branches-toggle";
import { useShowBamboo } from "@/components/bamboo-sentry-toggles";
import { useGeoLinker } from "@/components/geocities-effect";
import { BambooIcon } from "@/components/brand-icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const DEV_PHASES = new Set(["dev", "branch", "internal_dev"]);

function shouldShowFire(phase: string, createdAt: string, devFireMs: number, fireMs: number): boolean {
  const isDev = DEV_PHASES.has(phase);
  const thresholdMs = isDev ? devFireMs : fireMs;
  if (thresholdMs === 0) return false;
  return Date.now() - new Date(createdAt).getTime() < thresholdMs;
}

function FirmwareCell({
  versions,
  phase,
  productId,
  productName,
  showTimestamps,
  devFireMs,
  fireMs,
}: {
  versions: Record<string, VersionSummary> | undefined;
  phase: string;
  productId: number;
  productName: string;
  showTimestamps: boolean;
  devFireMs: number;
  fireMs: number;
}) {
  const linkify = useGeoLinker();
  const showBamboo = useShowBamboo();
  const entries = versions ? Object.entries(versions).sort(([a], [b]) => a.localeCompare(b)) : [];
  if (entries.length === 0) {
    return <TableCell className="text-center text-muted-foreground/30">-</TableCell>;
  }
  return (
    <TableCell className="px-3 py-2 text-xs">
      <div className="space-y-1">
        {entries.map(([plat, v]) => {
          const detailUrl = linkify(`/apps/${productId}#v-${v.versionId}`);
          const bambooUrl = `/api/bamboo/redirect?${new URLSearchParams({
            product: productName,
            kind: "apps",
            releaseName: v.version,
            fallback: detailUrl,
          })}`;
          return (
            <div key={plat} className="flex items-center">
              <a href={detailUrl} className="hover:bg-accent rounded px-1.5 py-0.5 -mx-1 transition-colors">
                <span className="font-mono text-foreground">{v.version}</span>
                <span className="text-amber-400 ml-1.5 font-medium">{plat}</span>
                {showTimestamps && <span className="text-muted-foreground ml-1.5">{formatTimestamp(v.createdAt)}</span>}
                {shouldShowFire(phase, v.createdAt, devFireMs, fireMs) && <span className="ml-1" title="Recent deploy">🔥</span>}
              </a>
              {showBamboo && (
                <a
                  href={bambooUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open Bamboo build"
                  className="inline-flex ml-1 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <BambooIcon />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </TableCell>
  );
}

export function FirmwareMatrix({
  rows,
  activePhases,
  showTimestamps = false,
  devFireMs = 0,
  fireMs = 7 * 24 * 60 * 60 * 1000,
}: {
  rows: MatrixRow[];
  activePhases?: Set<string>;
  showTimestamps?: boolean;
  devFireMs?: number;
  fireMs?: number;
}) {
  const showBranches = useShowBranches();
  const showBamboo = useShowBamboo();
  const linkify = useGeoLinker();
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">No firmware available.</p>;
  }

  const allPhases = getActivePhases(rows);
  const phases = activePhases ? allPhases.filter((p) => activePhases.has(p)) : allPhases;
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));

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
          {sorted.map((row) => (
            <TableRow key={row.id} className="border-border/30 hover:bg-accent/50 transition-colors">
              <TableCell className="font-medium">
                <a
                  href={linkify(`/apps/${row.id}`)}
                  className="text-primary hover:text-primary/80 hover:underline transition-colors"
                >
                  {row.description || row.name}
                </a>
                {showBamboo && row.bambooPlanUrl && (
                  <a
                    href={row.bambooPlanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open Bamboo plan"
                    className="inline-flex ml-1.5 text-muted-foreground hover:text-foreground transition-colors align-middle"
                  >
                    <BambooIcon />
                  </a>
                )}
                {showBranches && <BranchTag branch={row.branch} />}
                <div className="text-xs text-muted-foreground">{row.name}</div>
              </TableCell>
              {phases.map((phase) => (
                <FirmwareCell
                  key={phase}
                  versions={row.firmwareCells[phase]}
                  phase={phase}
                  productId={row.id}
                  productName={row.name}
                  showTimestamps={showTimestamps}
                  devFireMs={devFireMs}
                  fireMs={fireMs}
                />
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
