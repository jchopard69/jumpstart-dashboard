import type { Platform, SyncStatus } from "./types";

export type AdminClientHealthInput = {
  isActive: boolean;
  platforms: Platform[];
  lastSyncStatus: SyncStatus | null;
  lastSyncAt: string | null;
  now?: Date;
};

export type AdminClientHealth = {
  score: number;
  status: "healthy" | "watch" | "risk" | "inactive";
  label: string;
  summary: string;
  nextAction: string;
  staleDays: number | null;
};

const MS_DAY = 24 * 60 * 60 * 1000;

function daysSince(dateValue: string | null, now: Date): number | null {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / MS_DAY));
}

export function computeAdminClientHealth(input: AdminClientHealthInput): AdminClientHealth {
  const now = input.now ?? new Date();
  const staleDays = daysSince(input.lastSyncAt, now);

  if (!input.isActive) {
    return {
      score: 0,
      status: "inactive",
      label: "Inactif",
      summary: "Workspace désactivé.",
      nextAction: "Réactiver le client avant toute action opérationnelle.",
      staleDays,
    };
  }

  let score = 100;
  const risks: string[] = [];

  if (input.platforms.length === 0) {
    score -= 40;
    risks.push("aucune plateforme connectée");
  }

  if (!input.lastSyncAt) {
    score -= 35;
    risks.push("aucune synchronisation");
  } else if (staleDays != null && staleDays >= 7) {
    score -= 30;
    risks.push(`sync ancienne de ${staleDays} jours`);
  } else if (staleDays != null && staleDays >= 3) {
    score -= 15;
    risks.push(`sync à contrôler (${staleDays} jours)`);
  }

  if (input.lastSyncStatus === "failed") {
    score -= 35;
    risks.push("dernière sync en erreur");
  } else if (input.lastSyncStatus === "running") {
    score -= 10;
    risks.push("sync en cours");
  } else if (!input.lastSyncStatus) {
    score -= 10;
  }

  const boundedScore = Math.max(0, Math.min(100, score));
  const status: AdminClientHealth["status"] =
    boundedScore >= 75 ? "healthy" : boundedScore >= 45 ? "watch" : "risk";

  const label = status === "healthy" ? "Sain" : status === "watch" ? "À surveiller" : "À traiter";
  const summary = risks.length > 0 ? risks.slice(0, 2).join(" · ") : "Compte prêt pour le pilotage client.";
  const nextAction =
    input.platforms.length === 0
      ? "Connecter au moins une plateforme sociale."
      : input.lastSyncStatus === "failed"
        ? "Ouvrir le client et corriger la synchronisation."
        : !input.lastSyncAt || (staleDays != null && staleDays >= 3)
          ? "Relancer une synchronisation avant le prochain point client."
          : "Préparer la prochaine décision client à partir du dashboard.";

  return {
    score: boundedScore,
    status,
    label,
    summary,
    nextAction,
    staleDays,
  };
}
