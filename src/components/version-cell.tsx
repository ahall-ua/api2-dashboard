import type { VersionSummary } from "@/lib/types";
import { formatTimestamp } from "@/lib/version-utils";
import { PLATFORM_COLORS } from "@/lib/phase-constants";
import { getDeepLinkConfig, makeArchiveUrl } from "@/lib/deep-links";
import { useGeoLinker } from "@/components/geocities-effect";
import { BambooIcon, SentryIcons } from "@/components/brand-icons";
import type { BuildInfo } from "@/lib/bamboo-api";

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
  build,
  showBamboo,
  showSentry,
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
  build?: BuildInfo;
  showBamboo: boolean;
  showSentry: boolean;
}) {
  const hasBamboo = !NO_BAMBOO_TYPES.has(productType);
  const bambooUrl = hasBamboo ? bambooBuildUrl(kind, productName, productId, v.version) : null;
  const platformColor = PLATFORM_COLORS[platformLabel] || "";
  const linkify = useGeoLinker();
  const detailUrl = linkify(`/${kind}/${productId}#v-${v.versionId}`);

  const isHot = shouldShowFire(phase, v.createdAt, devFireMs, fireMs);
  return (
    <div className="flex items-center">
      <a
        href={detailUrl}
        className="hover:bg-accent rounded px-1.5 py-0.5 -mx-1 transition-colors"
      >
        <span className="font-mono text-foreground">{v.version}</span>
        <span className={`${platformColor} ml-1.5 font-medium`}>{platformLabel}</span>
        {showTimestamps && <span className="text-muted-foreground ml-1.5">{formatTimestamp(v.createdAt)}</span>}
      </a>
      {showBamboo && bambooUrl && (
        <a
          href={bambooUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open Bamboo build"
          className="inline-flex ml-1 hover:opacity-80 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <BambooIcon />
        </a>
      )}
      {showSentry && (
        <span className="ml-1 inline-flex items-center gap-1">
          <SentryIcons sentry={build?.sentry} platform={platformLabel} />
        </span>
      )}
      {isUaConnect ? (
        <Api2DownloadIcon kind={kind} productId={productId} versionId={v.versionId} />
      ) : deepLink?.archiveName ? (
        <ArchiveIcon url={makeArchiveUrl(deepLink, v.version)} />
      ) : null}
      {isHot && <span className="ml-1" title="Recent deploy">🔥</span>}
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
  builds,
  showBamboo = true,
  showSentry = false,
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
  builds?: Record<string, BuildInfo>;
  showBamboo?: boolean;
  showSentry?: boolean;
}) {
  if (!mac && !win && !all) {
    return <td className="px-3 py-2 text-center text-muted-foreground/30">-</td>;
  }

  const deepLink = getDeepLinkConfig(kind, productName || "", productType || "");
  const isUaConnect = productName === "UA_Connect";
  const common = { kind, productId, productName: productName || "", productType: productType || "", phase, showTimestamps, devFireMs, fireMs, isUaConnect, deepLink, showBamboo, showSentry };

  return (
    <td className="px-3 py-2 text-xs">
      <div className="space-y-1">
        {all && <VersionLine2 v={all} platformLabel="all" {...common} build={builds?.[all.version]} />}
        {!all && mac && <VersionLine2 v={mac} platformLabel="mac" {...common} build={builds?.[mac.version]} />}
        {!all && win && <VersionLine2 v={win} platformLabel="win" {...common} build={builds?.[win.version]} />}
      </div>
    </td>
  );
}
