/**
 * Small brand icons for inline use next to versions / product names.
 * Sized to roughly match lucide-react icons (~14px tall) so they sit
 * inline with text without dominating it.
 */

export function BambooIcon({ className = "" }: { className?: string }) {
  // Bamboo brand mark (path from simpleicons.org, CC0). Inline SVG with
  // currentColor so it adapts to surrounding text and renders cleanly at 14px.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="currentColor"
      className={`inline-block align-middle text-sky-500 ${className}`}
      aria-label="Bamboo"
    >
      <path d="M21.7142 13.6433h-4.9888a.651.651 0 00-.655.555 4.1139 4.1139 0 01-4.0619 3.5299l1.35 6.1728a10.3737 10.3737 0 009.0077-9.5447.651.651 0 00-.652-.713zm-8.6327-.158l7.1998-6.1718a.645.645 0 000-.984L13.0815.1597a.648.648 0 00-1.074.483v12.3426a.651.651 0 001.073.5zm-11.3547 1.505A10.3847 10.3847 0 0012.0115 24v-6.2698a4.0929 4.0929 0 01-4.0999-4.0869zm-.096-1.447v.1h6.2798a4.0929 4.0929 0 014.098-4.0879l-1.348-6.1698a10.3697 10.3697 0 00-9.0298 10.1577" />
    </svg>
  );
}

export function SentryIcon({ className = "" }: { className?: string }) {
  // Real Sentry brand mark (path from simpleicons.org, CC0). Uses currentColor
  // so it adapts to surrounding text color.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="currentColor"
      className={`inline-block align-middle text-purple-400 ${className}`}
      aria-label="Sentry"
    >
      <path d="M13.91 2.505c-.873-1.448-2.972-1.448-3.844 0L6.904 7.92a15.478 15.478 0 0 1 8.53 12.811h-2.221A13.301 13.301 0 0 0 5.784 9.814l-2.926 5.06a7.65 7.65 0 0 1 4.435 5.848H2.194a.365.365 0 0 1-.298-.534l1.413-2.402a5.16 5.16 0 0 0-1.614-.913L.296 19.275a2.182 2.182 0 0 0 .812 2.999 2.24 2.24 0 0 0 1.086.288h6.983a9.322 9.322 0 0 0-3.845-8.318l1.11-1.922a11.47 11.47 0 0 1 4.95 10.24h5.915a17.242 17.242 0 0 0-7.885-15.28l2.244-3.845a.37.37 0 0 1 .504-.13c.255.14 9.75 16.708 9.928 16.9a.365.365 0 0 1-.327.543h-2.287c.029.612.029 1.223 0 1.831h2.297a2.206 2.206 0 0 0 1.922-3.31z" />
    </svg>
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
