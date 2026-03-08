"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function TenantSyncButton({ tenantId }: { tenantId: string }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<null | { kind: "ok" | "error"; message: string }>(null);

  const run = () => {
    setStatus(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/client/refresh?tenantId=${encodeURIComponent(tenantId)}`, {
          method: "POST",
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setStatus({ kind: "error", message: data?.message ?? "Échec de la synchronisation." });
          return;
        }
        setStatus({ kind: "ok", message: data?.message ?? "Synchronisation lancée." });
      } catch {
        setStatus({ kind: "error", message: "Échec de la synchronisation." });
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={run} disabled={isPending}>
        {isPending ? "Sync…" : "Relancer sync"}
      </Button>
      {status?.kind === "error" ? (
        <span className="text-[10px] text-rose-700 max-w-[180px] truncate" title={status.message}>
          {status.message}
        </span>
      ) : status?.kind === "ok" ? (
        <span className="text-[10px] text-emerald-700 max-w-[180px] truncate" title={status.message}>
          {status.message}
        </span>
      ) : null}
    </div>
  );
}
