// Deep link configuration for UAC install and archive links.
// The `id` field maps to the api2 app/plugin `name` field.
// `host` is the uaconnect:// host+path prefix.
// `archiveName` is the archive folder name (omit for no archive link).
// `installOnly` limits which phases get install links (omit for all phases).

interface DeepLinkConfig {
  host: string;
  deepId: string;
  archiveName?: string;
  noInstallPhases?: string[];
}

const APP_DEEP_LINKS: Record<string, DeepLinkConfig> = {
  LUNA: {
    host: "main/luna",
    deepId: "luna",
    archiveName: "LUNABuilds",
  },
  "LUNA-Pro": {
    host: "main/luna",
    deepId: "luna",
    archiveName: "LUNABuilds",
  },
  "uad-console": {
    host: "main/apollo",
    deepId: "uad-console",
    archiveName: "UADConsoleBuilds",
  },
  UA_Services: {
    host: "v1.0",
    deepId: "ua_services",
    archiveName: "UAServicesBuilds",
  },
  UA_Labs: {
    host: "v1.0",
    deepId: "ua_labs",
    archiveName: "UALabsBuilds",
  },
  UAD2: {
    host: "main/apollo",
    deepId: "uad2",
    archiveName: "UAD2Builds",
  },
  UAD2_Driver: {
    host: "v1.0",
    deepId: "uad2_driver",
    archiveName: "UAD2Driver",
    noInstallPhases: ["dev", "alpha", "beta", "rc", "final", "internal_dev", "internal_final", "branch", "revoke"],
  },
};

// UAD2 plugins all share the same deep link pattern.
// The plugin `name` from api2 is used as the `deepId`.
const UAD2_PLUGIN_CONFIG: DeepLinkConfig = {
  host: "main/apollo",
  deepId: "", // filled in per-plugin
  archiveName: "UAD2PluginBuilds",
  noInstallPhases: ["internal_dev", "internal_final"],
};

export function getDeepLinkConfig(
  kind: "apps" | "plugins",
  name: string,
  type: string,
): DeepLinkConfig | null {
  if (kind === "apps") {
    return APP_DEEP_LINKS[name] || null;
  }

  // UAD2 plugins
  if (type === "uad2") {
    return { ...UAD2_PLUGIN_CONFIG, deepId: name };
  }

  return null;
}

export function makeInstallUrl(config: DeepLinkConfig, version: string): string {
  return `uaconnect://${config.host}?action=download&id=${config.deepId}&version=${version}`;
}

export function makeArchiveUrl(config: DeepLinkConfig, version: string): string {
  if (!config.archiveName) return "";
  return `uaconnect://${config.host}?action=download&id=${config.deepId}&archive=${config.archiveName}&version=${version}`;
}

export function shouldShowInstall(config: DeepLinkConfig, phase: string): boolean {
  if (config.noInstallPhases && config.noInstallPhases.includes(phase)) return false;
  return true;
}
