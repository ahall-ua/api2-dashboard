"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Api2Component } from "@/lib/types";

export function PluginComponentsButton({
  pluginId,
  versionId,
}: {
  pluginId: number;
  versionId: number;
}) {
  const [components, setComponents] = useState<Api2Component[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadComponents() {
    if (components) {
      setComponents(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/proxy/plugins/${pluginId}/versions/${versionId}/components`,
      );
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setComponents(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={loadComponents} className="text-xs">
        {loading ? "..." : components ? "Hide" : "API2 ↓"}
      </Button>
      {error && <span className="text-xs text-destructive ml-2">{error}</span>}
      {components && components.length > 0 && (
        <div className="mt-2 ml-4 space-y-1">
          {components.map((c) => (
            <div key={c.id} className="flex items-center gap-3 text-xs">
              <span className="font-mono">{c.name}</span>
              <span className="text-muted-foreground">
                {(c.size / 1024 / 1024).toFixed(1)} MB
              </span>
              {c.url && (
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Download
                </a>
              )}
            </div>
          ))}
        </div>
      )}
      {components && components.length === 0 && (
        <span className="text-xs text-muted-foreground ml-2">No components</span>
      )}
    </div>
  );
}
