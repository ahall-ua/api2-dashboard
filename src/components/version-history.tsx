"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PhaseFilter } from "@/components/phase-filter";
import { DownloadButton } from "@/components/download-button";
import { PluginComponentsButton } from "@/components/plugin-components";
import { formatVersion, formatTimestamp } from "@/lib/version-utils";
import { PHASE_COLORS, PLATFORM_COLORS } from "@/lib/phase-constants";
import { getDeepLinkConfig, makeInstallUrl, makeArchiveUrl, shouldShowInstall } from "@/lib/deep-links";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Api2Version } from "@/lib/types";

const DEV_PHASES = new Set(["dev", "branch", "internal_dev"]);

type BuildInfo = { resultKey: string; browseUrl: string; state: string };
// Keyed by formatted (non-padded) version string, matching Bamboo's buildReleaseName
type BuildMap = Record<string, BuildInfo>;

function VersionRow({
  releaseName,
  build,
  onVisible,
  children,
}: {
  releaseName: string;
  build: BuildInfo | undefined;
  onVisible: (releaseName: string) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLTableRowElement>(null);
  const triggered = useRef(false);

  useEffect(() => {
    if (build || triggered.current) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !triggered.current) {
          triggered.current = true;
          onVisible(releaseName);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [releaseName, build, onVisible]);

  return (
    <TableRow ref={ref} className="border-border/30 hover:bg-accent/50 transition-colors">
      {children}
    </TableRow>
  );
}

function shouldShowFire(phase: string, createdAt: string, devFireMs: number, fireMs: number): boolean {
  const isDev = DEV_PHASES.has(phase);
  const thresholdMs = isDev ? devFireMs : fireMs;
  if (thresholdMs === 0) return false;
  return Date.now() - new Date(createdAt).getTime() < thresholdMs;
}

export function VersionHistory({
  versions,
  kind,
  productId,
  appName,
  productType,
}: {
  versions: Api2Version[];
  kind: "apps" | "plugins";
  productId: number;
  appName?: string;
  productType?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [buildMap, setBuildMap] = useState<BuildMap>({});
  const pendingNames = useRef(new Set<string>());
  const fetchedNames = useRef(new Set<string>());
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setMounted(true), []);

  // Fetch bamboo build map for this product (recent builds from main + branch plans)
  useEffect(() => {
    if (!appName) return;
    const params = new URLSearchParams({ product: appName, kind });
    fetch(`/api/bamboo/builds?${params}`)
      .then((r) => (r.ok ? r.json() : { builds: {} }))
      .then((data: { builds: BuildMap }) => {
        setBuildMap(data.builds);
        for (const key of Object.keys(data.builds)) {
          fetchedNames.current.add(key);
        }
      })
      .catch(() => {});
  }, [appName, kind]);

  // Batch-fetch unresolved release names (called when rows scroll into view)
  const queueBuildLookup = useCallback(
    (releaseName: string) => {
      if (!appName || fetchedNames.current.has(releaseName) || pendingNames.current.has(releaseName)) return;
      pendingNames.current.add(releaseName);

      // Debounce: wait 200ms to collect a batch, then fetch all at once
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
      batchTimerRef.current = setTimeout(() => {
        const names = Array.from(pendingNames.current);
        pendingNames.current.clear();
        if (names.length === 0) return;

        // Mark as fetched so we don't re-request
        for (const n of names) fetchedNames.current.add(n);

        const params = new URLSearchParams({
          product: appName,
          kind,
          releaseNames: names.join(","),
        });
        fetch(`/api/bamboo/builds?${params}`)
          .then((r) => (r.ok ? r.json() : { builds: {} }))
          .then((data: { builds: BuildMap }) => {
            if (Object.keys(data.builds).length > 0) {
              setBuildMap((prev) => ({ ...prev, ...data.builds }));
            }
          })
          .catch(() => {});
      }, 200);
    },
    [appName, kind],
  );

  if (!mounted) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  const deepLink = getDeepLinkConfig(kind, appName || "", productType || "");
  const showUacInstall = kind === "apps" && appName === "UA_Connect";

  return (
    <PhaseFilter showTimestampsOption={false}>
      {({ activePhases, activePlatforms, devFireMs, fireMs }) => {
        const filtered = versions.filter((v) => {
          if (!activePhases.has(v.phase)) return false;
          if (!activePlatforms.has(v.platform)) return false;
          if (search) {
            const q = search.toLowerCase();
            const ver = formatVersion(v.version).toLowerCase();
            return ver.includes(q) || v.version.includes(q) || v.phase.includes(q) || v.platform.includes(q);
          }
          return true;
        });

        // Count columns for empty state colspan
        let colCount = 4; // version, platform, phase, deployed
        if (kind === "apps") {
          colCount++; // Download
          if (showUacInstall) colCount++; // UAC Install
        } else {
          colCount++; // Components
        }
        if (deepLink) {
          colCount++; // UAC Install or Archive
          if (deepLink.archiveName) colCount++; // Archive (if separate)
        }

        return (
          <>
          <div className="flex items-center gap-3 mb-4">
            <Input
              placeholder="Search versions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <span className="text-sm text-muted-foreground">
              {filtered.length}{search ? ` / ${versions.length}` : ""} versions
            </span>
          </div>
          <div className="border border-border/50 rounded-lg bg-card/50">
            <Table>
              <TableHeader className="sticky top-[49px] z-[5] bg-card shadow-sm">
                <TableRow className="border-border/50">
                  <TableHead>Version</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Phase</TableHead>
                  <TableHead>Deployed</TableHead>
                  {deepLink?.archiveName && (
                    <TableHead>UAC ↓</TableHead>
                  )}
                  <TableHead>API2 ↓</TableHead>
                  {showUacInstall && <TableHead>API2 Installer ↓</TableHead>}
                  {deepLink && shouldShowInstall(deepLink, "") && (
                    <TableHead>Install</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={colCount} className="text-center text-muted-foreground py-8">
                      No versions for selected filters
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((v) => {
                  const displayVer = formatVersion(v.version);
                  // Bamboo release names are non-padded, same as displayVer
                  const build = buildMap[displayVer];
                  return (
                    <VersionRow
                      key={v.id}
                      releaseName={displayVer}
                      build={build}
                      onVisible={queueBuildLookup}
                    >
                      <TableCell className="font-mono text-sm">
                        {build ? (
                          <a
                            href={build.browseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline text-blue-600 dark:text-blue-400"
                            title={`Bamboo: ${build.resultKey}`}
                          >
                            {displayVer}
                          </a>
                        ) : (
                          displayVer
                        )}
                        {shouldShowFire(v.phase, v.created_at, devFireMs, fireMs) && (
                          <span className="ml-1.5" title="Recent deploy">🔥</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={PLATFORM_COLORS[v.platform] || ""}>
                          {v.platform}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={PHASE_COLORS[v.phase] || ""}>
                          {v.phase}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTimestamp(v.created_at)}
                      </TableCell>
                      {deepLink?.archiveName && (
                        <TableCell>
                          <a
                            href={makeArchiveUrl(deepLink, displayVer)}
                            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-xs")}
                          >
                            UAC ↓
                          </a>
                        </TableCell>
                      )}
                      <TableCell>
                        {kind === "plugins" ? (
                          <PluginComponentsButton pluginId={productId} versionId={v.id} />
                        ) : (
                          <DownloadButton kind={kind} productId={productId} versionId={v.id} urlField="update_url" label="API2 ↓" />
                        )}
                      </TableCell>
                      {showUacInstall && (
                        <TableCell>
                          <DownloadButton kind={kind} productId={productId} versionId={v.id} urlField="install_url" label="API2 Installer ↓" />
                        </TableCell>
                      )}
                      {deepLink && shouldShowInstall(deepLink, "") && (
                        <TableCell>
                          {shouldShowInstall(deepLink, v.phase) ? (
                            <a
                              href={makeInstallUrl(deepLink, displayVer)}
                              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-xs")}
                            >
                              Install
                            </a>
                          ) : (
                            <span className="text-muted-foreground/30 text-xs">-</span>
                          )}
                        </TableCell>
                      )}
                    </VersionRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          </>
        );
      }}
    </PhaseFilter>
  );
}
