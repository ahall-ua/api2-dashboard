import type { Api2App, Api2Plugin, Api2Version, MatrixRow, MatrixCell, VersionSummary, Platform, Phase } from "./types";

/**
 * Format a zero-padded version string for display.
 * "0002.0000.0003.008978.ci-next" -> "2.0.3.8978.ci-next"
 */
export function formatVersion(raw: string): string {
  // Strip leading zeros from any digit-prefix in each dot-separated segment.
  // "0001" -> "1", "000101-win" -> "101-win", "0002-K8" -> "2-K8".
  return raw
    .split(".")
    .map((part) => part.replace(/^0+(\d)/, "$1"))
    .join(".");
}

/**
 * Format an ISO timestamp for compact display.
 * "2026-03-28T20:42:18+00:00" -> "3/28 20:42"
 */
export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  return `${month}/${day}/${year} ${hours}:${minutes}`;
}

function toVersionSummary(v: Api2Version): VersionSummary {
  return {
    versionId: v.id,
    version: formatVersion(v.version),
    rawVersion: v.version,
    platform: v.platform as Platform,
    phase: v.phase,
    createdAt: v.created_at,
    installUrl: v.install_url,
    updateUrl: v.update_url,
  };
}

/**
 * Merge a product's latest_version (from a single phase+platform query)
 * into an existing matrix row. Creates the row if it doesn't exist yet.
 */
export function mergeIntoMatrix(
  matrix: Map<number, MatrixRow>,
  product: Api2App | Api2Plugin,
  phase: string,
  platform: string,
): void {
  if (!product.latest_version) return;

  let row = matrix.get(product.id);
  if (!row) {
    row = {
      id: product.id,
      name: product.name,
      description: product.description,
      type: product.type,
      cells: {},
      firmwareCells: {},
    };
    matrix.set(product.id, row);
  }

  const v = product.latest_version;
  const actualPlatform = v.platform;

  if (actualPlatform === "mac" || actualPlatform === "win" || actualPlatform === "all") {
    if (!row.cells[phase]) {
      row.cells[phase] = { mac: null, win: null, all: null };
    }
    const current = row.cells[phase][actualPlatform];
    if (!current || v.version > current.rawVersion) {
      row.cells[phase][actualPlatform] = toVersionSummary(v);
    }
  } else {
    // Firmware platform (emperor, prince, node, neoN, nelowN, ...)
    if (!row.firmwareCells[phase]) row.firmwareCells[phase] = {};
    const current = row.firmwareCells[phase][actualPlatform];
    if (!current || v.version > current.rawVersion) {
      row.firmwareCells[phase][actualPlatform] = toVersionSummary(v);
    }
  }
}

export function hasStandardVersions(row: MatrixRow): boolean {
  return Object.values(row.cells).some((c) => c.mac || c.win || c.all);
}

export function hasFirmwareVersions(row: MatrixRow): boolean {
  return Object.values(row.firmwareCells).some((m) => Object.keys(m).length > 0);
}

/**
 * Distinct firmware platforms present across all rows, sorted.
 */
export function getFirmwarePlatforms(rows: MatrixRow[]): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    for (const phase of Object.values(row.firmwareCells)) {
      for (const plat of Object.keys(phase)) set.add(plat);
    }
  }
  return [...set].sort();
}

/**
 * Cascade phase data down the hierarchy.
 *
 * Phases form a hierarchy: dev < alpha < beta < rc < final.
 * A user with "dev" access sees the highest version across ALL phases.
 * A user with "beta" access sees the highest across beta, rc, final.
 *
 * So for each phase, the displayed version should be the highest version
 * from that phase or any phase above it in the hierarchy.
 *
 * Example: if a product only has a version in "beta", the dev, alpha,
 * and beta columns should all show that version (it's the highest available
 * to users at each of those access levels). The rc and final columns stay empty.
 */
export function cascadePhases(rows: MatrixRow[]): void {
  const hierarchy: Phase[] = ["dev", "alpha", "beta", "rc", "final"];

  for (const row of rows) {
    // Firmware: cascade per firmware platform
    const fwPlatforms = new Set<string>();
    for (const phase of Object.values(row.firmwareCells)) {
      for (const p of Object.keys(phase)) fwPlatforms.add(p);
    }
    for (const plat of fwPlatforms) {
      let best: VersionSummary | null = null;
      for (let i = hierarchy.length - 1; i >= 0; i--) {
        const phase = hierarchy[i];
        const v = row.firmwareCells[phase]?.[plat];
        if (v && (!best || v.rawVersion > best.rawVersion)) best = v;
        if (best) {
          if (!row.firmwareCells[phase]) row.firmwareCells[phase] = {};
          const cur = row.firmwareCells[phase][plat];
          if (!cur || best.rawVersion > cur.rawVersion) {
            row.firmwareCells[phase][plat] = best;
          }
        }
      }
    }

    for (const plat of ["mac", "win", "all"] as Platform[]) {
      // Walk from dev → final, tracking the highest version seen so far
      // from the *opposite* direction: final is the most restrictive,
      // so we scan from final → dev, carrying the best version backward.
      let best: VersionSummary | null = null;

      for (let i = hierarchy.length - 1; i >= 0; i--) {
        const phase = hierarchy[i];
        const cell = row.cells[phase];
        if (cell && cell[plat]) {
          // This phase has its own version — is it higher than what we've seen?
          if (!best || cell[plat]!.rawVersion > best.rawVersion) {
            best = cell[plat];
          }
        }

        // Fill this phase's cell with the best version visible at this access level
        if (best) {
          if (!row.cells[phase]) {
            row.cells[phase] = { mac: null, win: null, all: null };
          }
          if (!row.cells[phase][plat] || best.rawVersion > row.cells[phase][plat]!.rawVersion) {
            row.cells[phase][plat] = best;
          }
        }
      }
    }
  }
}

/**
 * Get the best version a user at a given access level would see.
 * A user with "dev" access sees the highest version across dev, alpha, beta, rc, final.
 * A user with "final" access sees only final.
 * For non-hierarchy phases (branch, internal_dev, etc.), returns that phase's exact data.
 */
export function getBestVersionForAccessLevel(
  row: MatrixRow,
  accessPhase: string,
  platform: Platform,
): VersionSummary | null {
  const hierarchy: Phase[] = ["dev", "alpha", "beta", "rc", "final"];
  const idx = hierarchy.indexOf(accessPhase as Phase);

  // Non-hierarchy phase — just return exact match
  if (idx === -1) {
    return row.cells[accessPhase]?.[platform] || row.cells[accessPhase]?.all || null;
  }

  // Hierarchy phase — find best from this level and above
  let best: VersionSummary | null = null;
  for (let i = idx; i < hierarchy.length; i++) {
    const cell = row.cells[hierarchy[i]];
    // Check the specific platform, then fall back to "all"
    const v = cell?.[platform] || (platform !== "all" ? cell?.all : null);
    if (v && (!best || v.rawVersion > best.rawVersion)) {
      best = v;
    }
  }
  return best;
}

/**
 * Get all distinct phases present in a matrix, in a sensible display order.
 */
export function getActivePhases(rows: MatrixRow[]): string[] {
  const knownOrder = ["dev", "alpha", "beta", "rc", "final", "internal_dev", "internal_final", "branch", "revoke"];
  const allPhases = new Set<string>();

  for (const row of rows) {
    for (const phase of Object.keys(row.cells)) allPhases.add(phase);
    for (const phase of Object.keys(row.firmwareCells)) allPhases.add(phase);
  }

  const ordered: string[] = [];
  for (const p of knownOrder) {
    if (allPhases.has(p)) {
      ordered.push(p);
      allPhases.delete(p);
    }
  }
  ordered.push(...[...allPhases].sort());

  return ordered;
}

const TYPE_DISPLAY_NAMES: Record<string, string> = {
  lunacomponent_with_wrappers: "uadx",
  lunacomponent: "uadx-luna",
  uad2: "uad2",
  external: "external",
  native: "other",
};

const TYPE_ORDER = ["uadx", "uadx-luna", "uad2", "external", "other"];

export function displayType(rawType: string): string {
  return TYPE_DISPLAY_NAMES[rawType] || rawType || "other";
}

/**
 * Group matrix rows by product type for display.
 */
export function groupByType(rows: MatrixRow[]): Map<string, MatrixRow[]> {
  const groups = new Map<string, MatrixRow[]>();
  for (const row of rows) {
    const type = displayType(row.type);
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type)!.push(row);
  }
  for (const rows of groups.values()) {
    rows.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Re-order: known types first in TYPE_ORDER, then the rest alphabetically
  const ordered = new Map<string, MatrixRow[]>();
  for (const t of TYPE_ORDER) {
    if (groups.has(t)) {
      ordered.set(t, groups.get(t)!);
      groups.delete(t);
    }
  }
  for (const [t, r] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    ordered.set(t, r);
  }
  return ordered;
}
