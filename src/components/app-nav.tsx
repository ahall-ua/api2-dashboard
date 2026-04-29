"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function AppNav({ username, env }: { username?: string; env: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onGrid = pathname.startsWith("/grid");
  const title = onGrid ? "Grid" : "Dashboard";

  // Carry shared filter state across the Dashboard/Grid swap. Grid ignores
  // `phase` (it uses `phases` plural for column visibility), but preserving
  // it means dashboard → grid → dashboard remembers the user's phase choice.
  const carryParams = new URLSearchParams();
  for (const key of ["show", "phase", "branches", "geocities"]) {
    const val = searchParams.get(key);
    if (val) carryParams.set(key, val);
  }
  const carryQs = carryParams.toString();
  const carrySuffix = carryQs ? `?${carryQs}` : "";

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm px-6 py-3 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-primary">API2</span> {title}
        </h1>
        <Badge
          variant="secondary"
          className={env === "stage"
            ? "bg-amber-600 text-amber-100"
            : "bg-emerald-600 text-emerald-100"
          }
        >
          {env}
        </Badge>
        <nav className="flex gap-3 text-sm">
          {onGrid ? (
            <a href={`/dashboard${carrySuffix}`} className="text-muted-foreground hover:text-foreground transition-colors">
              Dashboard
            </a>
          ) : (
            <a href={`/grid${carrySuffix}`} className="text-muted-foreground hover:text-foreground transition-colors">
              Grid
            </a>
          )}
        </nav>
      </div>
      <div className="flex items-center gap-3 text-sm">
        {username && <span className="text-muted-foreground">{username}</span>}
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
