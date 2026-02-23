"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
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
  const toast = useToast();
  const router = useRouter();

  const handleRefresh = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const query = tenantId ? `?tenantId=${tenantId}` : "";
      const res = await fetch(`/api/client/refresh${query}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message ?? "Synchronisation terminée");
        router.refresh();
      } else {
        toast.error(data.error ?? "Erreur de synchronisation");
      }
    } catch {
      toast.error("Erreur réseau. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleRefresh}
      disabled={loading}
      className="gap-1.5"
    >
      <RefreshIcon className={cn("h-4 w-4", loading && "animate-spin")} />
      {loading ? "Synchronisation..." : "Rafraîchir"}
    </Button>
  );
}
