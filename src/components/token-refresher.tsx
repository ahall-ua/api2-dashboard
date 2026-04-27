"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function TokenRefresher() {
  const router = useRouter();

  useEffect(() => {
    async function refresh() {
      const res = await fetch("/api/auth/refresh");
      if (!res.ok) {
        router.push("/login");
      }
    }
    refresh();
  }, [router]);

  return null;
}
