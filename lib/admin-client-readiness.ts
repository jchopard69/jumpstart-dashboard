export type AdminClientReadinessAccount = {
  auth_status: string | null;
  last_error: string | null;
  last_sync_at: string | null;
};

export type AdminClientReadinessLog = {
  status: string | null;
  started_at: string | null;
  finished_at: string | null;
};

export type AdminClientReadinessGoals = {
  followers_target: number | null;
  engagement_rate_target: number | null;
  posts_per_week_target: number | null;
  reach_target: number | null;
  views_target: number | null;
} | null;

export type AdminClientReadiness = {
  status: "ready" | "watch" | "risk";
  label: string;
  score: number;
  summary: string;
  nextAction: string;
  proof: string;
  risks: string[];
  strengths: string[];
  priorityAnchor: "#accounts" | "#goals" | "#strategy" | "#collaboration" | "#sync-logs";
};

type BuildAdminClientReadinessParams = {
  accounts: AdminClientReadinessAccount[];
  logs: AdminClientReadinessLog[];
  goals: AdminClientReadinessGoals;
  strategyStatus: "healthy" | "watch" | "risk";
  strategyCoverage: number;
  highPriorityCollaborationActions: number;
  isDemoTenant?: boolean;
  now?: Date;
};

const DAY_MS = 1000 * 60 * 60 * 24;

function daysSince(value: string | null | undefined, now: Date) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((now.getTime() - date.getTime()) / DAY_MS);
}

function countConfiguredGoals(goals: AdminClientReadinessGoals) {
  if (!goals) return 0;
  return [
    goals.followers_target,
    goals.engagement_rate_target,
    goals.posts_per_week_target,
    goals.reach_target,
    goals.views_target,
  ].filter((value) => typeof value === "number" && Number.isFinite(value) && value > 0).length;
}

export function buildAdminClientReadiness({
  accounts,
  logs,
  goals,
  strategyStatus,
  strategyCoverage,
  highPriorityCollaborationActions,
  isDemoTenant = false,
  now = new Date(),
}: BuildAdminClientReadinessParams): AdminClientReadiness {
  const risks: string[] = [];
  const strengths: string[] = [];
  const connectedAccounts = accounts.filter((account) => account.auth_status === "active");
  const brokenAccounts = accounts.filter((account) =>
    account.auth_status === "expired" || account.auth_status === "revoked" || Boolean(account.last_error)
  );
  const latestLog = logs
    .filter((log) => log.started_at)
    .sort((a, b) => new Date(String(b.started_at)).getTime() - new Date(String(a.started_at)).getTime())[0] ?? null;
  const latestSyncAge = daysSince(latestLog?.finished_at ?? latestLog?.started_at, now);
  const configuredGoals = countConfiguredGoals(goals);

  if (isDemoTenant) strengths.push("workspace démo isolé");

  if (accounts.length === 0) {
    risks.push("aucun compte connecté");
  } else if (brokenAccounts.length > 0) {
    risks.push(`${brokenAccounts.length} compte${brokenAccounts.length > 1 ? "s" : ""} à corriger`);
  } else {
    strengths.push(`${connectedAccounts.length} compte${connectedAccounts.length > 1 ? "s" : ""} actif${connectedAccounts.length > 1 ? "s" : ""}`);
  }

  if (!latestLog) {
    risks.push("aucune synchronisation");
  } else if (latestLog.status === "failed") {
    risks.push("dernière synchronisation en erreur");
  } else if (latestSyncAge !== null && latestSyncAge >= 7) {
    risks.push(`sync ancienne de ${latestSyncAge} jours`);
  } else if (latestLog.status === "success") {
    strengths.push("synchronisation récente");
  }

  if (configuredGoals < 3) {
    risks.push(`${configuredGoals}/5 objectifs configurés`);
  } else {
    strengths.push(`${configuredGoals}/5 objectifs configurés`);
  }

  if (strategyStatus === "risk") {
    risks.push("stratégie à cadrer");
  } else if (strategyStatus === "watch") {
    risks.push("stratégie à surveiller");
  } else {
    strengths.push(`${strategyCoverage}/8 blocs stratégiques`);
  }

  if (highPriorityCollaborationActions > 0) {
    risks.push(`${highPriorityCollaborationActions} priorité collaboration`);
  } else {
    strengths.push("collaboration sous contrôle");
  }

  const accountRisk = accounts.length === 0 || brokenAccounts.length > 0;
  const syncRisk = !latestLog || latestLog.status === "failed" || (latestSyncAge !== null && latestSyncAge >= 7);
  const goalsRisk = configuredGoals < 3;
  const strategyRisk = strategyStatus !== "healthy";
  const collaborationRisk = highPriorityCollaborationActions > 0;

  let priorityAnchor: AdminClientReadiness["priorityAnchor"] = "#accounts";
  let nextAction = "Corriger les comptes connectés avant de relancer la synchronisation.";
  if (!accountRisk && syncRisk) {
    priorityAnchor = "#sync-logs";
    nextAction = "Relancer la synchronisation et vérifier les logs avant le prochain point client.";
  } else if (!accountRisk && !syncRisk && goalsRisk) {
    priorityAnchor = "#goals";
    nextAction = "Compléter les objectifs pour rendre les scores et exports plus actionnables.";
  } else if (!accountRisk && !syncRisk && !goalsRisk && strategyRisk) {
    priorityAnchor = "#strategy";
    nextAction = "Compléter le cadrage stratégique et publier une prochaine action claire.";
  } else if (!accountRisk && !syncRisk && !goalsRisk && !strategyRisk && collaborationRisk) {
    priorityAnchor = "#collaboration";
    nextAction = "Traiter les priorités collaboration avant le prochain reporting.";
  } else if (!accountRisk && !syncRisk && !goalsRisk && !strategyRisk && !collaborationRisk) {
    priorityAnchor = "#sync-logs";
    nextAction = "Maintenir la cadence et surveiller les prochains signaux faibles.";
  }

  const riskScore = Math.min(65, risks.length * 12 + (accountRisk ? 12 : 0) + (syncRisk ? 10 : 0));
  const score = Math.max(30, 96 - riskScore);
  const status: AdminClientReadiness["status"] = score < 65 ? "risk" : score < 84 ? "watch" : "ready";

  return {
    status,
    label: status === "ready" ? "Prêt client" : status === "watch" ? "À surveiller" : "À corriger",
    score,
    summary: risks.length > 0
      ? "Certains prérequis empêchent d'exploiter pleinement ce client dans la V2."
      : "Les prérequis opérationnels sont en place pour produire de la valeur client.",
    nextAction,
    proof: risks[0] ?? strengths[0] ?? "Aucun signal disponible",
    risks,
    strengths: strengths.slice(0, 4),
    priorityAnchor,
  };
}
