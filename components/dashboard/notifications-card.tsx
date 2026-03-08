import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
}: {
  notifications: NotificationData[];
  unreadCount?: number;
}) {
  if (!notifications?.length) return null;

  return (
    <section>
      <Card className="card-surface p-6 fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title">Notifications</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Événements récents (sync, connexions).</p>
          </div>
          {unreadCount > 0 && (
            <span className="rounded-full bg-purple-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-700">
              {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {notifications.map((n) => {
            const t = getTypeLabel(n.type);
            return (
              <div
                key={n.id}
                className="rounded-2xl border border-border/60 bg-white/70 p-4"
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
                    </div>
                    <p className="mt-2 text-sm font-medium leading-snug truncate">{n.title}</p>
                    {n.message && (
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">{n.message}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}
