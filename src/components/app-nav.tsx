"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function AppNav({ username, env }: { username?: string; env: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm px-6 py-3 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-primary">API2</span> Dashboard
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
          <a href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
            Overview
          </a>
          <a href="/dashboard/monitor?phase=beta" className="text-muted-foreground hover:text-foreground transition-colors">
            Beta Monitor
          </a>
          <a href="/dashboard/monitor?phase=final" className="text-muted-foreground hover:text-foreground transition-colors">
            Final Monitor
          </a>
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
