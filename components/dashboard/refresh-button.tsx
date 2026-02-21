"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

export function RefreshButton({ tenantId }: { tenantId?: string }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleRefresh = async () => {
    setLoading(true);
    setStatus("idle");
    setMessage(null);
    try {
      const query = tenantId ? `?tenantId=${tenantId}` : "";
      const res = await fetch(`/api/client/refresh${query}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage(data.message ?? "Synchronisation terminée");
        // Auto-hide success message
        setTimeout(() => {
          setMessage(null);
          setStatus("idle");
        }, 3000);
      } else {
        setStatus("error");
        setMessage(data.error ?? "Erreur de synchronisation");
      }
    } catch {
      setStatus("error");
      setMessage("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="secondary" onClick={handleRefresh} disabled={loading}>
        <RefreshIcon className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")} />
        {loading ? "Sync..." : "Rafraîchir"}
      </Button>
      {message && (
        <p className={cn(
          "text-xs",
          status === "success" && "text-emerald-600",
          status === "error" && "text-rose-600",
          status === "idle" && "text-muted-foreground"
        )}>
          {message}
        </p>
      )}
    </div>
  );
}
