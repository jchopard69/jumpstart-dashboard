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

function getSeverity(metadata: NotificationData["metadata"]) {
  const severity = metadata && typeof metadata === "object" ? metadata.severity : null;
  return severity === "high" ? "high" : severity === "medium" ? "medium" : "normal";
}

function getMetadataSummary(notification: NotificationData) {
  const metrics = notification.metadata?.metrics;
  if (!Array.isArray(metrics)) return null;
  const labels = metrics
    .slice(0, 3)
    .map((metric) => {
      if (!metric || typeof metric !== "object") return null;
      const label = "label" in metric ? String(metric.label) : null;
      const drop = "drop_percent" in metric ? Number(metric.drop_percent) : null;
      if (!label || !Number.isFinite(drop)) return null;
      return `${label} ${Math.round(drop as number)}%`;
    })
    .filter(Boolean);
  return labels.length ? labels.join(" · ") : null;
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
              <span className="rounded-full border border-primary/15 bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
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
            const severity = getSeverity(n.metadata);
            const metadataSummary = getMetadataSummary(n);
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => !n.is_read && markOneRead(n.id)}
                aria-label={`${n.title}${n.is_read ? "" : ", non lu"}`}
                className={[
                  "w-full rounded-2xl border bg-white/70 p-4 text-left transition-colors hover:bg-white/85",
                  severity === "high"
                    ? "border-rose-200 bg-rose-50/70"
                    : severity === "medium"
                      ? "border-amber-200 bg-amber-50/60"
                      : "border-border/60",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={t.badge}>{t.label}</Badge>
                      {severity === "high" && (
                        <Badge variant="danger">Prioritaire</Badge>
                      )}
                      {!n.is_read && (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" title="Non lu" aria-hidden="true" />
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
                    {metadataSummary && (
                      <p className="mt-2 text-xs font-medium text-foreground/75">{metadataSummary}</p>
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
