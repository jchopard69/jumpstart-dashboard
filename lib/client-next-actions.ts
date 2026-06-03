import type { DashboardActionItem } from "./dashboard-action-plan";
import type { DashboardOpportunity } from "./dashboard-opportunities";
import type { ClientStrategySnapshot } from "./client-strategy";

export type ClientNextAction = {
  id: string;
  label: string;
  title: string;
  detail: string;
  proof: string;
  href: string;
  priority: "high" | "medium" | "low";
};

const DASHBOARD_ACTION_LABELS: Record<DashboardActionItem["priority"], string> = {
  high: "A traiter",
  medium: "A planifier",
  low: "A optimiser",
};

function dashboardHref(action: DashboardActionItem): string {
  if (action.id.startsWith("data-") || action.id.startsWith("coverage-") || action.id === "refresh-data") {
    return "#dashboard-operations";
  }
  if (action.id.includes("engagement") || action.id.includes("publishing") || action.id.includes("frequency")) {
    return "#dashboard-content";
  }
  return "#dashboard-kpis";
}

function addUnique(actions: ClientNextAction[], action: ClientNextAction) {
  if (!actions.some((item) => item.id === action.id)) {
    actions.push(action);
  }
}

export function buildClientNextActions(params: {
  actionPlan: DashboardActionItem[];
  opportunities: DashboardOpportunity[];
  strategy: ClientStrategySnapshot;
  tenantId?: string | null;
}): ClientNextAction[] {
  const nextActions: ClientNextAction[] = [];
  const { actionPlan, opportunities, strategy, tenantId } = params;
  const strategyHref = tenantId
    ? `/client/strategy?tenantId=${encodeURIComponent(tenantId)}`
    : "/client/strategy";

  const urgentDashboardAction = actionPlan.find((action) => action.priority === "high") ?? actionPlan[0];
  if (urgentDashboardAction) {
    addUnique(nextActions, {
      id: `dashboard-${urgentDashboardAction.id}`,
      label: DASHBOARD_ACTION_LABELS[urgentDashboardAction.priority],
      title: urgentDashboardAction.title,
      detail: urgentDashboardAction.rationale,
      proof: urgentDashboardAction.metric ?? urgentDashboardAction.horizon,
      href: dashboardHref(urgentDashboardAction),
      priority: urgentDashboardAction.priority,
    });
  }

  const strongestOpportunity =
    opportunities.find((opportunity) => opportunity.confidence === "Haute") ?? opportunities[0];
  if (strongestOpportunity) {
    addUnique(nextActions, {
      id: `opportunity-${strongestOpportunity.id}`,
      label: "A transformer",
      title: strongestOpportunity.title,
      detail: strongestOpportunity.automation,
      proof: strongestOpportunity.evidence,
      href: strongestOpportunity.href ?? "#dashboard-content",
      priority: strongestOpportunity.confidence === "Haute" ? "high" : "medium",
    });
  }

  const activeStrategyAction =
    strategy.actionItems.find((item) => item.status !== "done" && (item.priority === "critical" || item.priority === "high")) ??
    strategy.actionItems.find((item) => item.status !== "done");
  if (activeStrategyAction) {
    addUnique(nextActions, {
      id: `strategy-${activeStrategyAction.id}`,
      label: activeStrategyAction.owner === "client" ? "Cote client" : activeStrategyAction.owner === "jumpstart" ? "Cote JumpStart" : "Action partagee",
      title: activeStrategyAction.title,
      detail: activeStrategyAction.rationale ?? "Action issue du plan stratégique JumpStart.",
      proof: activeStrategyAction.expected_impact ?? activeStrategyAction.due_date ?? "Stratégie active",
      href: strategyHref,
      priority: activeStrategyAction.priority === "critical" || activeStrategyAction.priority === "high" ? "high" : activeStrategyAction.priority === "medium" ? "medium" : "low",
    });
  } else if (strategy.profile?.monthly_focus || strategy.latestBrief?.next_focus) {
    addUnique(nextActions, {
      id: "strategy-focus",
      label: "Focus mensuel",
      title: strategy.profile?.monthly_focus ?? strategy.latestBrief?.next_focus ?? "Aligner le focus du mois",
      detail: "Transformer le focus stratégique en prochaines publications, briefs et décisions de production.",
      proof: strategy.latestBrief?.title ?? "Direction JumpStart",
      href: strategyHref,
      priority: "medium",
    });
  }

  if (!nextActions.length) {
    addUnique(nextActions, {
      id: "baseline-client-loop",
      label: "Rituel client",
      title: "Valider les apprentissages de la période",
      detail: "Passer en revue les performances, confirmer les formats à conserver et préparer la prochaine itération.",
      proof: "Synthèse dashboard",
      href: "#dashboard-insights",
      priority: "low",
    });
  }

  const priorityRank = { high: 0, medium: 1, low: 2 };
  return nextActions.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]).slice(0, 3);
}
