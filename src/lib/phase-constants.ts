export const ALL_PHASES = ["dev", "alpha", "beta", "rc", "final", "internal_dev", "internal_final", "branch", "revoke"];
// Phases fetched eagerly on dashboard load. Other phases are fetched on-demand
// when the user toggles them on. Keeping the standard hierarchy (dev..final)
// here so cascadePhases produces correct results without re-running on the client.
export const DEFAULT_FETCH_PHASES = ["dev", "alpha", "beta", "rc", "final"];
export const EXTRA_PHASES = ["internal_dev", "internal_final", "branch", "revoke"];
export const DEFAULT_ACTIVE_PHASES = new Set(["dev", "alpha", "beta", "final"]);
export const NO_FIRE_PHASES = new Set(["dev", "branch", "internal_dev"]);

export const PHASE_COLORS: Record<string, string> = {
  dev:            "bg-slate-600 text-slate-100",
  alpha:          "bg-sky-600 text-sky-100",
  beta:           "bg-amber-600 text-amber-100",
  rc:             "bg-orange-600 text-orange-100",
  final:          "bg-emerald-600 text-emerald-100",
  internal_dev:   "bg-teal-600 text-teal-100",
  internal_final: "bg-cyan-600 text-cyan-100",
  branch:         "bg-violet-600 text-violet-100",
  revoke:         "bg-red-600 text-red-100",
};

export const PHASE_TOGGLE_COLORS: Record<string, { on: string; off: string }> = {
  dev:            { on: "bg-slate-600 text-slate-100",     off: "bg-slate-800/50 text-slate-500" },
  alpha:          { on: "bg-sky-600 text-sky-100",         off: "bg-sky-900/30 text-sky-600" },
  beta:           { on: "bg-amber-600 text-amber-100",     off: "bg-amber-900/30 text-amber-600" },
  rc:             { on: "bg-orange-600 text-orange-100",    off: "bg-orange-900/30 text-orange-600" },
  final:          { on: "bg-emerald-600 text-emerald-100",  off: "bg-emerald-900/30 text-emerald-600" },
  internal_dev:   { on: "bg-teal-600 text-teal-100",       off: "bg-teal-900/30 text-teal-600" },
  internal_final: { on: "bg-cyan-600 text-cyan-100",       off: "bg-cyan-900/30 text-cyan-600" },
  branch:         { on: "bg-violet-600 text-violet-100",    off: "bg-violet-900/30 text-violet-600" },
  revoke:         { on: "bg-red-600 text-red-100",          off: "bg-red-900/30 text-red-600" },
};

export const PLATFORM_COLORS: Record<string, string> = {
  mac: "text-sky-400",
  win: "text-violet-400",
  all: "text-zinc-400",
};

export const ALL_PLATFORMS = ["mac", "win", "all"];
export const DEFAULT_ACTIVE_PLATFORMS = new Set(["mac", "win", "all"]);

export const PLATFORM_TOGGLE_COLORS: Record<string, { on: string; off: string }> = {
  mac: { on: "bg-sky-600 text-sky-100",     off: "bg-sky-900/30 text-sky-600" },
  win: { on: "bg-violet-600 text-violet-100", off: "bg-violet-900/30 text-violet-600" },
  all: { on: "bg-zinc-600 text-zinc-100",    off: "bg-zinc-800/50 text-zinc-500" },
};
