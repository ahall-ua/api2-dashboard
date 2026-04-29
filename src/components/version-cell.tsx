import type { VersionSummary } from "@/lib/types";
import { formatTimestamp } from "@/lib/version-utils";
import { PLATFORM_COLORS } from "@/lib/phase-constants";
import { getDeepLinkConfig, makeArchiveUrl } from "@/lib/deep-links";

const DEV_PHASES = new Set(["dev", "branch", "internal_dev"]);

// Product types that don't have Bamboo plans in the manifest
const NO_BAMBOO_TYPES = new Set(["lunacomponent_with_wrappers", "lunacomponent"]);

function bambooBuildUrl(
  kind: string,
  productName: string,
  productId: number,
  displayVersion: string,
): string {
  const params = new URLSearchParams({
    product: productName,
    kind,
    releaseName: displayVersion,
    fallback: `/${kind}/${productId}`,
  });
  return `/api/bamboo/redirect?${params}`;
}

function shouldShowFire(phase: string, createdAt: string, devFireMs: number, fireMs: number): boolean {
  const isDev = DEV_PHASES.has(phase);
  const thresholdMs = isDev ? devFireMs : fireMs;
  if (thresholdMs === 0) return false;
  return Date.now() - new Date(createdAt).getTime() < thresholdMs;
}

function ArchiveIcon({ url }: { url: string }) {
  return (
    <a
      href={url}
      title="Download via UA Connect"
      className="inline-flex ml-1.5 text-emerald-400 hover:text-emerald-300 transition-colors"
      onClick={(e) => e.stopPropagation()}
    >
      ↓
    </a>
  );
}

function Api2DownloadIcon({ kind, productId, versionId }: { kind: string; productId: number; versionId: number }) {
  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const res = await fetch(`/api/proxy/${kind}/${productId}/versions/${versionId}`);
    if (!res.ok) return;
    const data = await res.json();
    const url = data.private_install_url || data.install_url;
    if (url) window.open(url, "_blank");
  }

  return (
    <a
      href="#"
      title="Download installer from API2"
      className="inline-flex ml-1.5 text-sky-400 hover:text-sky-300 transition-colors"
      onClick={handleClick}
    >
      ↓
    </a>
  );
}

function VersionLine2({
  v,
  platformLabel,
  kind,
  productId,
  productName,
  productType,
  phase,
  showTimestamps,
  devFireMs,
  fireMs,
  isUaConnect,
  deepLink,
}: {
  v: VersionSummary;
  platformLabel: string;
  kind: string;
  productId: number;
  productName: string;
  productType: string;
  phase: string;
  showTimestamps: boolean;
  devFireMs: number;
  fireMs: number;
  isUaConnect: boolean;
  deepLink: ReturnType<typeof getDeepLinkConfig>;
}) {
  const hasBamboo = !NO_BAMBOO_TYPES.has(productType);
  const bambooUrl = hasBamboo ? bambooBuildUrl(kind, productName, productId, v.version) : null;
  const platformColor = PLATFORM_COLORS[platformLabel] || "";

  const inner = (
    <>
      <span className="font-mono text-foreground">{v.version}</span>
      <span className={`${platformColor} ml-1.5 font-medium`}>{platformLabel}</span>
      {showTimestamps && <span className="text-muted-foreground ml-1.5">{formatTimestamp(v.createdAt)}</span>}
      {shouldShowFire(phase, v.createdAt, devFireMs, fireMs) && <span className="ml-1" title="Recent deploy">🔥</span>}
    </>
  );

  return (
    <div className="flex items-center">
      {bambooUrl ? (
        <a
          href={bambooUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:bg-accent rounded px-1.5 py-0.5 -mx-1 transition-colors"
        >
          {inner}
        </a>
      ) : (
        <span className="rounded px-1.5 py-0.5 -mx-1">{inner}</span>
      )}
      {isUaConnect ? (
        <Api2DownloadIcon kind={kind} productId={productId} versionId={v.versionId} />
      ) : deepLink?.archiveName ? (
        <ArchiveIcon url={makeArchiveUrl(deepLink, v.version)} />
      ) : null}
    </div>
  );
}

export function VersionCell({
  mac,
  win,
  all,
  kind,
  productId,
  productName,
  productType,
  phase,
  showTimestamps = false,
  devFireMs = 0,
  fireMs = 7 * 24 * 60 * 60 * 1000,
}: {
  mac: VersionSummary | null;
  win: VersionSummary | null;
  all: VersionSummary | null;
  kind: "apps" | "plugins";
  productId: number;
  productName?: string;
  productType?: string;
  phase: string;
  showTimestamps?: boolean;
  devFireMs?: number;
  fireMs?: number;
}) {
  if (!mac && !win && !all) {
    return <td className="px-3 py-2 text-center text-muted-foreground/30">-</td>;
  }

  const deepLink = getDeepLinkConfig(kind, productName || "", productType || "");
  const isUaConnect = productName === "UA_Connect";
  const common = { kind, productId, productName: productName || "", productType: productType || "", phase, showTimestamps, devFireMs, fireMs, isUaConnect, deepLink };

  return (
    <td className="px-3 py-2 text-xs">
      <div className="space-y-1">
        {all && <VersionLine2 v={all} platformLabel="all" {...common} />}
        {!all && mac && <VersionLine2 v={mac} platformLabel="mac" {...common} />}
        {!all && win && <VersionLine2 v={win} platformLabel="win" {...common} />}
      </div>
    </td>
  );
}
