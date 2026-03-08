"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function TenantNotificationsButton({ tenantId, disabled }: { tenantId: string; disabled?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<null | { kind: "ok" | "error"; message: string }>(null);

  const markAllRead = () => {
    setStatus(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/notifications/mark-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId, all: true }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setStatus({ kind: "error", message: data?.error ?? "Erreur" });
          return;
        }
        setStatus({ kind: "ok", message: "OK" });
      } catch {
        setStatus({ kind: "error", message: "Erreur" });
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs"
        onClick={markAllRead}
        disabled={disabled || isPending}
        title="Marquer toutes les notifications de ce tenant comme lues"
      >
        {isPending ? "…" : "Notifs lues"}
      </Button>
      {status?.kind === "ok" ? (
        <span className="text-[10px] text-emerald-700">OK</span>
      ) : status?.kind === "error" ? (
        <span className="text-[10px] text-rose-700" title={status.message}>Err</span>
      ) : null}
    </div>
  );
}
