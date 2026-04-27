"use client";

import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DownloadButton({
  kind,
  productId,
  versionId,
  urlField,
  label,
}: {
  kind: "apps" | "plugins";
  productId: number;
  versionId: number;
  urlField: "install_url" | "update_url";
  label: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/proxy/${kind}/${productId}/versions/${versionId}`);
      if (!res.ok) return;
      const data = await res.json();
      // Prefer signed private URLs, fall back to unsigned
      const privateField = `private_${urlField}`;
      const url = data[privateField] || data[urlField];
      if (url) {
        window.open(url, "_blank");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-xs")}
    >
      {loading ? "..." : label}
    </button>
  );
}
