"use client";

import { useRouter, useSearchParams } from "next/navigation";

const MAIN_BRANCHES = new Set(["master", "main"]);

// Default ON — present "branches=0" in URL means user explicitly turned it off.
export function useShowBranches(): boolean {
  const searchParams = useSearchParams();
  return searchParams.get("branches") !== "0";
}

export function BranchesToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const on = searchParams.get("branches") !== "0";

  function toggle() {
    const params = new URLSearchParams(searchParams.toString());
    if (on) params.set("branches", "0");
    else params.delete("branches");
    const qs = params.toString();
    router.replace(window.location.pathname + (qs ? `?${qs}` : ""), { scroll: false });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`px-2.5 py-0.5 text-xs rounded-md font-medium transition-colors ${
        on ? "bg-emerald-600 text-emerald-100" : "bg-emerald-900/30 text-emerald-600"
      }`}
    >
      Branches
    </button>
  );
}

export function BranchTag({ branch }: { branch?: string }) {
  if (!branch) return null;
  const isMain = MAIN_BRANCHES.has(branch);
  return (
    <span className={`text-xs ml-2 font-medium ${isMain ? "text-emerald-500" : "text-orange-500"}`}>
      {branch}
    </span>
  );
}
