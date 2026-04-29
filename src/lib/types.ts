// API2 entity types — based on actual api2.uaudio.com response shapes

export interface Api2App {
  id: number;
  created_at: string;
  updated_at: string;
  name: string;
  description: string;
  author: string;
  type: string;
  phase: string;
  product_id: string;
  licenses: Api2License[];
  app_data: Record<string, string> | null;
  // Present when version_phase and version_platform query params are used
  latest_version?: Api2Version | null;
}

export interface Api2Plugin {
  id: number;
  created_at: string;
  updated_at: string;
  name: string;
  description: string;
  author: string;
  type: string;
  phase: string;
  product_id: string;
  licenses: Api2License[];
  plugin_data: Record<string, string> | null;
  // Present when version_phase and version_platform query params are used
  latest_version?: Api2Version | null;
}

export interface Api2License {
  id: number;
  created_at: string;
  updated_at: string;
  name: string;
  type: string;
  license_id: string;
  pace_sku: string | null;
  item_number: string;
}

export interface Api2Version {
  id: number;
  created_at: string;
  updated_at: string;
  version: string;
  description: string;
  platform: string;
  phase: string;
  user_meta: string;
  app_meta: string;
  install_url: string;
  update_url: string;
  url_expiration: number;
  private_install_url: string | null;
  private_update_url: string | null;
}

export interface Api2Component {
  id: number;
  created_at: string;
  updated_at: string;
  name: string;
  version: string;
  author: string;
  phase: string;
  url: string;
  size: number;
  hash: string;
  requires_encryption: boolean;
  root: boolean;
}

// Dashboard-specific types

export type Phase = "dev" | "alpha" | "beta" | "rc" | "final";
export type Platform = "mac" | "win" | "all";

export const PHASES: Phase[] = ["dev", "alpha", "beta", "rc", "final"];
export const PLATFORMS: Platform[] = ["mac", "win"];

// Firmware platform values (codenames for pedal/Apollo/mic hardware).
// Anything in api2 with a `platform` not in {mac, win, all} is firmware.
// To discover new values when new pedals ship: query /apps/{id}/versions
// directly via the api2 client and inspect the distinct `platform` values
// across products that don't appear in the matrix.
export const FIRMWARE_PLATFORMS = [
  "emperor",
  "prince",
  "node",
  "neo1",
  "neo2",
  "neo4l",
  "neo4pre",
  "neo8",
  "nelow1",
  "nelow2",
  "nelow4l",
] as const;

export const STANDARD_PLATFORMS = new Set<string>(["mac", "win", "all"]);

export interface VersionSummary {
  versionId: number;
  version: string;
  rawVersion: string;
  platform: Platform;
  phase: string;
  createdAt: string;
  installUrl: string;
  updateUrl: string;
}

export interface MatrixCell {
  mac: VersionSummary | null;
  win: VersionSummary | null;
  all: VersionSummary | null;
}

export interface MatrixRow {
  id: number;
  name: string;
  description: string;
  type: string;
  cells: Record<string, MatrixCell>;
  // phase -> firmware platform name -> latest VersionSummary
  firmwareCells: Record<string, Record<string, VersionSummary>>;
  // Bamboo CI branch (from manifest), populated server-side. May be undefined.
  branch?: string;
  // URL to the product's Bamboo plan (prefers nightly), populated server-side.
  bambooPlanUrl?: string;
}
