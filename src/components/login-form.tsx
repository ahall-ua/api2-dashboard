"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Env = "prod" | "stage";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [env, setEnv] = useState<Env>("prod");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, env }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      // Navigate — keep loading=true so the form stays disabled
      window.location.href = searchParams.get("redirect") || "/dashboard";
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm border-border/50 bg-card/80 shadow-2xl">
      <CardHeader>
        <CardTitle className="text-xl"><span className="text-primary">API2</span> Dashboard</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Environment</Label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEnv("prod")}>
                <Badge
                  variant="secondary"
                  className={`cursor-pointer select-none transition-all ${
                    env === "prod"
                      ? "bg-emerald-600 text-emerald-100 shadow-sm"
                      : "bg-emerald-900/30 text-emerald-600 opacity-60"
                  }`}
                >
                  prod
                </Badge>
              </button>
              <button type="button" onClick={() => setEnv("stage")}>
                <Badge
                  variant="secondary"
                  className={`cursor-pointer select-none transition-all ${
                    env === "stage"
                      ? "bg-amber-600 text-amber-100 shadow-sm"
                      : "bg-amber-900/30 text-amber-600 opacity-60"
                  }`}
                >
                  stage
                </Badge>
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Email</Label>
            <Input
              id="username"
              type="email"
              placeholder="you@uaudio.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : `Sign in to ${env}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
