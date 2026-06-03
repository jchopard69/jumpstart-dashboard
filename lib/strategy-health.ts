import type { ClientStrategySnapshot, StrategyActionItem } from "./client-strategy";

export type StrategyHealth = {
  status: "healthy" | "watch" | "risk";
  label: string;
  score: number;
  summary: string;
  nextAction: string;
  proof: string;
  coverage: number;
  activeActions: number;
  urgentActions: number;
  completedActions: number;
  briefAgeDays: number | null;
};

type BuildStrategyHealthParams = {
  snapshot: ClientStrategySnapshot;
  now?: Date;
};

const DAY_MS = 1000 * 60 * 60 * 24;

function splitStrategyValue(value: string | null | undefined): string[] {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function strategyCoverage(snapshot: ClientStrategySnapshot) {
  const profile = snapshot.profile;
  if (!profile) return 0;
  return [
    profile.positioning,
    profile.target_audience,
    profile.offer_focus,
    profile.brand_voice,
    profile.editorial_pillars,
    profile.current_quarter_objectives,
    profile.monthly_focus,
    profile.jumpstart_note,
  ].filter((value) => splitStrategyValue(value).length > 0).length;
}

function daysUntil(dateValue: string | null, now: Date) {
  if (!dateValue) return null;
  const due = new Date(dateValue);
  const today = new Date(now);
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / DAY_MS);
}

function daysSince(dateValue: string | null | undefined, now: Date) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  return Math.floor((now.getTime() - date.getTime()) / DAY_MS);
}

function isUrgentAction(action: StrategyActionItem, now: Date) {
  if (action.status === "done") return false;
  if (action.priority === "critical" || action.priority === "high") return true;
  const dueDays = daysUntil(action.due_date, now);
  return dueDays !== null && dueDays >= 0 && dueDays <= 7;
}

export function buildStrategyHealth({
  snapshot,
  now = new Date(),
}: BuildStrategyHealthParams): StrategyHealth {
  const coverage = strategyCoverage(snapshot);
  const activeActions = snapshot.actionItems.filter((action) => action.status !== "done");
  const completedActions = snapshot.actionItems.length - activeActions.length;
  const urgentActions = activeActions.filter((action) => isUrgentAction(action, now));
  const pausedActions = activeActions.filter((action) => action.status === "paused");
  const briefAgeDays = daysSince(snapshot.latestBrief?.period_month, now);

  if (!snapshot.profile && !snapshot.latestBrief && snapshot.actionItems.length === 0) {
    return {
      status: "risk",
      label: "À cadrer",
      score: 30,
      summary: "Aucun cadre stratégique publié n'est encore disponible côté client.",
      nextAction: "Formaliser le positionnement, la cible prioritaire et le focus du mois.",
      proof: "0 bloc stratégique renseigné",
      coverage,
      activeActions: 0,
      urgentActions: 0,
      completedActions: 0,
      briefAgeDays: null,
    };
  }

  if (coverage < 4) {
    return {
      status: "risk",
      label: "Cadre incomplet",
      score: 48,
      summary: "Le socle stratégique est trop partiel pour guider les arbitrages de contenu.",
      nextAction: "Compléter au moins positionnement, cibles, objectifs du trimestre et piliers éditoriaux.",
      proof: `${coverage}/8 blocs renseignés`,
      coverage,
      activeActions: activeActions.length,
      urgentActions: urgentActions.length,
      completedActions,
      briefAgeDays,
    };
  }

  if (urgentActions.length > 0) {
    const criticalCount = urgentActions.filter((action) => action.priority === "critical").length;
    return {
      status: criticalCount > 0 ? "risk" : "watch",
      label: criticalCount > 0 ? "Priorité critique" : "Priorité active",
      score: criticalCount > 0 ? 58 : 72,
      summary: "Le plan stratégique contient des actions qui doivent être arbitrées rapidement.",
      nextAction: "Traiter la première priorité ouverte et confirmer le responsable de suivi.",
      proof: `${urgentActions.length} action${urgentActions.length > 1 ? "s" : ""} prioritaire${urgentActions.length > 1 ? "s" : ""}`,
      coverage,
      activeActions: activeActions.length,
      urgentActions: urgentActions.length,
      completedActions,
      briefAgeDays,
    };
  }

  if (pausedActions.length > 0) {
    return {
      status: "watch",
      label: "Actions en pause",
      score: 70,
      summary: "Certaines actions sont en pause et peuvent ralentir la trajectoire prévue.",
      nextAction: "Décider si les actions en pause doivent être relancées, remplacées ou clôturées.",
      proof: `${pausedActions.length} action${pausedActions.length > 1 ? "s" : ""} en pause`,
      coverage,
      activeActions: activeActions.length,
      urgentActions: urgentActions.length,
      completedActions,
      briefAgeDays,
    };
  }

  if (!snapshot.latestBrief || (briefAgeDays !== null && briefAgeDays > 45)) {
    return {
      status: "watch",
      label: "Brief à rafraîchir",
      score: 74,
      summary: "Le cadre existe, mais le brief mensuel doit être actualisé pour garder la direction lisible.",
      nextAction: "Publier un nouveau brief avec apprentissages, focus et actions JumpStart.",
      proof: snapshot.latestBrief ? `Dernier brief il y a ${briefAgeDays} jours` : "Aucun brief publié",
      coverage,
      activeActions: activeActions.length,
      urgentActions: urgentActions.length,
      completedActions,
      briefAgeDays,
    };
  }

  if (activeActions.length === 0) {
    return {
      status: "watch",
      label: "Action à définir",
      score: 78,
      summary: "Le cadre est lisible, mais aucune action active ne transforme la stratégie en exécution.",
      nextAction: "Ajouter une action recommandée avec responsable, impact attendu et échéance.",
      proof: `${completedActions} action${completedActions > 1 ? "s" : ""} finalisée${completedActions > 1 ? "s" : ""}`,
      coverage,
      activeActions: 0,
      urgentActions: 0,
      completedActions,
      briefAgeDays,
    };
  }

  return {
    status: "healthy",
    label: "Direction claire",
    score: coverage >= 7 ? 94 : 88,
    summary: "Le cadre stratégique, le brief et le plan d'action sont exploitables pour le client.",
    nextAction: "Continuer le suivi des actions ouvertes et convertir les apprentissages en prochain brief.",
    proof: `${coverage}/8 blocs, ${activeActions.length} action${activeActions.length > 1 ? "s" : ""} active${activeActions.length > 1 ? "s" : ""}`,
    coverage,
    activeActions: activeActions.length,
    urgentActions: 0,
    completedActions,
    briefAgeDays,
  };
}
