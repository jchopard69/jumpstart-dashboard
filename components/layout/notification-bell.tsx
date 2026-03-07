"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  Bell,
  AlertTriangle,
  Unplug,
  TrendingDown,
  Target,
  Info,
  Check,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

type NotificationType =
  | "sync_failure"
  | "account_disconnect"
  | "metric_drop"
  | "score_drop"
  | "info";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

const POLL_INTERVAL = 60_000; // 60 seconds

const TYPE_CONFIG: Record<
  NotificationType,
  { icon: typeof Bell; color: string; bg: string }
> = {
  sync_failure: {
    icon: AlertTriangle,
    color: "text-red-500",
    bg: "bg-red-50",
  },
  account_disconnect: {
    icon: Unplug,
    color: "text-orange-500",
    bg: "bg-orange-50",
  },
  metric_drop: {
    icon: TrendingDown,
    color: "text-amber-500",
    bg: "bg-amber-50",
  },
  score_drop: {
    icon: Target,
    color: "text-purple-500",
    bg: "bg-purple-50",
  },
  info: {
    icon: Info,
    color: "text-blue-500",
    bg: "bg-blue-50",
  },
};

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // Silently fail on polling errors
    }
  }, []);

  // Initial fetch & polling
  useEffect(() => {
    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchNotifications]);

  // Refetch when popover opens
  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  const markAllRead = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, is_read: true }))
        );
        setUnreadCount(0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id: string) => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {
      // ignore
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={cn(
            "relative rounded-lg p-2 transition-colors hover:bg-purple-500/10",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40"
          )}
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ""}`}
        >
          <Bell className="h-5 w-5 text-gray-600" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className={cn(
            "z-50 w-[380px] max-h-[480px] overflow-hidden rounded-xl border border-border/70 bg-white shadow-xl",
            "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
            <h3 className="section-title text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={loading}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-purple-600 transition-colors",
                  "hover:bg-purple-500/10 disabled:opacity-50"
                )}
              >
                <Check className="h-3 w-3" />
                Marquer tout comme lu
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bell className="mb-3 h-8 w-8 text-gray-300" />
                <p className="section-label text-sm text-gray-400">
                  Aucune notification
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/30">
                {notifications.map((notification) => {
                  const config = TYPE_CONFIG[notification.type] ?? TYPE_CONFIG.info;
                  const Icon = config.icon;

                  return (
                    <li
                      key={notification.id}
                      className={cn(
                        "flex gap-3 px-4 py-3 transition-colors hover:bg-gray-50/80",
                        !notification.is_read && "bg-purple-50/40"
                      )}
                    >
                      {/* Type icon */}
                      <div
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          config.bg
                        )}
                      >
                        <Icon className={cn("h-4 w-4", config.color)} />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              "text-sm leading-snug",
                              !notification.is_read
                                ? "font-semibold text-gray-900"
                                : "font-medium text-gray-700"
                            )}
                          >
                            {notification.title}
                          </p>
                          {!notification.is_read && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markRead(notification.id);
                              }}
                              className="mt-0.5 shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                              title="Marquer comme lu"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        {notification.message && (
                          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-gray-500">
                            {notification.message}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-gray-400">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                            locale: fr,
                          })}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
