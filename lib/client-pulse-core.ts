import type { SyncStatus } from "./types";

export type ClientPulse = {
  score: number | null;
  grade: string | null;
  unreadNotifications: number;
  activeActions: number;
  lastSyncStatus: SyncStatus | null;
  lastSyncAt: string | null;
  status: "healthy" | "watch" | "attention";
  headline: string;
  nextHref: "/client/dashboard" | "/client/strategy" | "/client/reports";
  nextLabel: string;
};

export function buildClientPulse(params: {
  score?: number | null;
  grade?: string | null;
  unreadNotifications?: number | null;
  activeActions?: number | null;
  lastSyncStatus?: SyncStatus | null;
  lastSyncAt?: string | null;
}): ClientPulse {
  const score = typeof params.score === "number" && Number.isFinite(params.score) ? params.score : null;
  const unreadNotifications = Math.max(0, params.unreadNotifications ?? 0);
  const activeActions = Math.max(0, params.activeActions ?? 0);
  const syncIsStale = params.lastSyncAt
    ? Date.now() - new Date(params.lastSyncAt).getTime() > 48 * 60 * 60 * 1000
    : false;

  if (params.lastSyncStatus === "failed" || unreadNotifications > 0) {
    return {
      score,
      grade: params.grade ?? null,
      unreadNotifications,
      activeActions,
      lastSyncStatus: params.lastSyncStatus ?? null,
      lastSyncAt: params.lastSyncAt ?? null,
      status: "attention",
      headline: unreadNotifications > 0
        ? `${unreadNotifications} alerte${unreadNotifications > 1 ? "s" : ""} à traiter`
        : "Synchronisation à vérifier",
      nextHref: "/client/dashboard",
      nextLabel: "Voir les alertes",
    };
  }

  if (activeActions > 0 || syncIsStale || (score != null && score < 70)) {
    return {
      score,
      grade: params.grade ?? null,
      unreadNotifications,
      activeActions,
      lastSyncStatus: params.lastSyncStatus ?? null,
      lastSyncAt: params.lastSyncAt ?? null,
      status: "watch",
      headline: activeActions > 0
        ? `${activeActions} action${activeActions > 1 ? "s" : ""} stratégique${activeActions > 1 ? "s" : ""}`
        : syncIsStale
          ? "Données à rafraîchir"
          : "Score à renforcer",
      nextHref: activeActions > 0 ? "/client/strategy" : "/client/dashboard",
      nextLabel: activeActions > 0 ? "Ouvrir la stratégie" : "Analyser le dashboard",
    };
  }

  return {
    score,
    grade: params.grade ?? null,
    unreadNotifications,
    activeActions,
    lastSyncStatus: params.lastSyncStatus ?? null,
    lastSyncAt: params.lastSyncAt ?? null,
    status: "healthy",
    headline: "Pilotage sous contrôle",
    nextHref: "/client/reports",
    nextLabel: "Partager le rapport",
  };
}
