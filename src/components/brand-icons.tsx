/**
 * Small brand icons for inline use next to versions / product names.
 * Sized to roughly match lucide-react icons (~14px tall) so they sit
 * inline with text without dominating it.
 */

export function BambooIcon({ className = "" }: { className?: string }) {
  // Source is 420x75: the logo glyph (left ~75x75 square) plus the "Bamboo"
  // wordmark to its right. Render just the glyph as a 14x14 square via
  // background-position cropping. Scale: 75 -> 14 means full image 78x14.
  return (
    <span
      role="img"
      aria-label="Bamboo"
      className={`inline-block w-[14px] h-[14px] align-middle bg-no-repeat bg-left ${className}`}
      style={{ backgroundImage: "url(/bamboo.png)", backgroundSize: "78px 14px" }}
    />
  );
}

export function SentryIcon({ className = "" }: { className?: string }) {
  return (
    <img
      src="/sentry.png"
      alt="Sentry"
      width={14}
      height={14}
      className={`inline-block w-[14px] h-[14px] align-middle ${className}`}
    />
  );
}

/**
 * Render Sentry release links scoped to the version's platform:
 *  - mac/win versions → the matching link only
 *  - "all" versions   → both links, each with a small m/w marker
 */
export function SentryIcons({
  sentry,
  platform,
}: {
  sentry?: { mac?: string; win?: string };
  platform: string;
}) {
  if (!sentry) return null;
  const showMac = !!sentry.mac && (platform === "mac" || platform === "all");
  const showWin = !!sentry.win && (platform === "win" || platform === "all");
  const isAll = platform === "all";
  return (
    <>
      {showMac && (
        <a
          href={sentry.mac}
          target="_blank"
          rel="noopener noreferrer"
          title="Sentry release (mac)"
          className="inline-flex items-center hover:opacity-80 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <SentryIcon />
          {isAll && <span className="text-[10px] ml-0.5 text-muted-foreground">m</span>}
        </a>
      )}
      {showWin && (
        <a
          href={sentry.win}
          target="_blank"
          rel="noopener noreferrer"
          title="Sentry release (win)"
          className="inline-flex items-center hover:opacity-80 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <SentryIcon />
          {isAll && <span className="text-[10px] ml-0.5 text-muted-foreground">w</span>}
        </a>
      )}
    </>
  );
}
