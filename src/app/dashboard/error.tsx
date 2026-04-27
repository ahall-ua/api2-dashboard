"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const isAuthError = error.message.includes("401") || error.message.includes("Token expired");

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <p className="text-destructive">
        {isAuthError ? "Session expired. Please sign in again." : `Error: ${error.message}`}
      </p>
      {isAuthError ? (
        <Button onClick={() => (window.location.href = "/login")}>Sign in</Button>
      ) : (
        <Button variant="outline" onClick={reset}>
          Retry
        </Button>
      )}
    </div>
  );
}
