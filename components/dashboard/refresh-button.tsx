"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function RefreshButton({ tenantId }: { tenantId?: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleRefresh = async () => {
    setLoading(true);
    setMessage(null);
    const query = tenantId ? `?tenantId=${tenantId}` : "";
    const res = await fetch(`/api/client/refresh${query}`, { method: "POST" });
    const data = await res.json();
    setLoading(false);
    setMessage(data.message ?? "Synchronisation lancée.");
  };

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="secondary" onClick={handleRefresh} disabled={loading}>
        {loading ? "Synchronisation..." : "Rafraîchir"}
      </Button>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
