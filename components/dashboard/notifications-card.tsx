"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NotificationData } from "@/lib/types/dashboard";

function getTypeLabel(type: NotificationData["type"]) {
  switch (type) {
    case "sync_failure":
      return { label: "Sync", badge: "danger" as const };
    case "account_disconnect":
      return { label: "Connexion", badge: "warning" as const };
    case "metric_drop":
      return { label: "Alerte", badge: "warning" as const };
    case "score_drop":
      return { label: "Score", badge: "warning" as const };
    default:
      return { label: "Info", badge: "secondary" as const };
  }
}

function formatRelative(dateIso: string) {
  const then = new Date(dateIso);
  if (Number.isNaN(then.getTime())) return "";
  const diffMs = Date.now() - then.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 2) return "à l’instant";
  if (mins < 60) return `il y a ${mins} min`;
  if (hours < 24) return `il y a ${hours}h`;
  return `il y a ${days}j`;
}

export function NotificationsCard({
  notifications,
  unreadCount = 0,
  tenantId,
}: {
  notifications: NotificationData[];
  unreadCount?: number;
  tenantId?: string | null;
}) {
  const [items, setItems] = useState(notifications);
  const [unread, setUnread] = useState(unreadCount);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!items?.length) return null;

  const markAllRead = () => {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/client/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true, tenantId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Impossible de marquer comme lu.");
        return;
      }
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
    });
  };

  const markOneRead = (id: string) => {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/client/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, tenantId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Impossible de marquer comme lu.");
        return;
      }
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnread((prev) => Math.max(0, prev - 1));
    });
  };

  return (
    <section>
      <Card className="card-surface p-6 fade-in-up">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="section-title">Notifications</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Événements récents (sync, connexions).</p>
          </div>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <span className="rounded-full bg-purple-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-700">
                {unread} non lue{unread > 1 ? "s" : ""}
              </span>
            )}
            {unread > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={markAllRead}
                disabled={isPending}
              >
                Tout marquer lu
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            {error}
          </div>
        )}

        <div className="mt-4 space-y-3">
          {items.map((n) => {
            const t = getTypeLabel(n.type);
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => !n.is_read && markOneRead(n.id)}
                className="w-full text-left rounded-2xl border border-border/60 bg-white/70 p-4 transition-colors hover:bg-white/85"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={t.badge}>{t.label}</Badge>
                      {!n.is_read && (
                        <span className="h-1.5 w-1.5 rounded-full bg-purple-500" title="Non lu" />
                      )}
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatRelative(n.created_at)}
                      </p>
                      {!n.is_read && (
                        <span className="text-[10px] text-muted-foreground">• cliquer pour marquer lu</span>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-medium leading-snug truncate">{n.title}</p>
                    {n.message && (
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">{n.message}</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Card>
    </section>
  );
}
