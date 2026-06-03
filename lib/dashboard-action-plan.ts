import type { DashboardDataQuality } from "./dashboard-data-quality";
import type { TenantGoals } from "./goals";
import { computeEngagementRate } from "./metrics";
import type { Platform } from "./types";

type Totals = {
  followers: number;
  views: number;
  reach: number;
  engagements: number;
  posts_count: number;
};

type PlatformSummary = {
  platform: Platform;
  totals: Totals;
  delta?: {
    followers: number;
    views: number;
    reach: number;
    engagements: number;
    posts_count: number;
  };
};

export type DashboardActionItem = {
  id: string;
  priority: "high" | "medium" | "low";
  horizon: "Aujourd'hui" | "Cette semaine" | "Ce mois-ci";
  title: string;
  rationale: string;
  metric?: string;
};

const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "X",
};

function formatPercent(value: number): string {
  return `${value > 0 ? "+" : ""}${Math.round(value)}%`;
}

function addUnique(actions: DashboardActionItem[], item: DashboardActionItem) {
  if (!actions.some((existing) => existing.id === item.id)) {
    actions.push(item);
  }
}

export function buildDashboardActionPlan(params: {
  totals: Totals;
  prevTotals: Totals;
  platforms: PlatformSummary[];
  periodDays: number;
  goals?: TenantGoals | null;
  dataQuality: DashboardDataQuality;
}): DashboardActionItem[] {
  const actions: DashboardActionItem[] = [];
  const { totals, prevTotals, platforms, periodDays, goals, dataQuality } = params;
  const currentEngagementRate = computeEngagementRate(totals.engagements, totals.views, totals.reach) ?? 0;
  const previousEngagementRate = computeEngagementRate(prevTotals.engagements, prevTotals.views, prevTotals.reach) ?? 0;
  const postsPerWeek = periodDays > 0 ? (totals.posts_count / periodDays) * 7 : 0;

  const missingPlatform = dataQuality.platformQuality.find((item) => item.status === "missing");
  const partialPlatform = dataQuality.platformQuality.find((item) => item.status === "partial");
  if (missingPlatform) {
    addUnique(actions, {
      id: `data-${missingPlatform.platform}`,
      priority: "high",
      horizon: "Aujourd'hui",
      title: `Réparer les données ${PLATFORM_LABELS[missingPlatform.platform]}`,
      rationale: "Les décisions clients sont fragilisées tant que cette source n'est pas fiable.",
      metric: `${missingPlatform.coverage}% de couverture`,
    });
  } else if (partialPlatform) {
    addUnique(actions, {
      id: `coverage-${partialPlatform.platform}`,
      priority: "medium",
      horizon: "Cette semaine",
      title: `Contrôler la couverture ${PLATFORM_LABELS[partialPlatform.platform]}`,
      rationale: "Une couverture partielle peut masquer les meilleurs contenus et fausser les tendances.",
      metric: `${partialPlatform.coverage}% de couverture`,
    });
  } else if (dataQuality.staleSync) {
    addUnique(actions, {
      id: "refresh-data",
      priority: "high",
      horizon: "Aujourd'hui",
      title: "Relancer la synchronisation",
      rationale: "Les données anciennes réduisent la valeur des recommandations opérationnelles.",
      metric: "Synchro > 48h",
    });
  }

  if (goals?.engagement_rate_target && currentEngagementRate > 0 && currentEngagementRate < goals.engagement_rate_target) {
    addUnique(actions, {
      id: "engagement-target",
      priority: "high",
      horizon: "Cette semaine",
      title: "Remonter le taux d'engagement",
      rationale: "Ajoutez des questions, appels à commentaire et formats interactifs sur les prochains contenus.",
      metric: `${currentEngagementRate.toFixed(1)}% / objectif ${goals.engagement_rate_target}%`,
    });
  } else if (previousEngagementRate > 0 && currentEngagementRate < previousEngagementRate * 0.8) {
    addUnique(actions, {
      id: "engagement-drop",
      priority: "high",
      horizon: "Cette semaine",
      title: "Analyser la baisse d'engagement",
      rationale: "Comparez les formats récents avec les contenus qui performaient sur la période précédente.",
      metric: `${currentEngagementRate.toFixed(1)}% vs ${previousEngagementRate.toFixed(1)}%`,
    });
  }

  if (goals?.posts_per_week_target && postsPerWeek < goals.posts_per_week_target) {
    addUnique(actions, {
      id: "publishing-rhythm",
      priority: "medium",
      horizon: "Cette semaine",
      title: "Renforcer le rythme éditorial",
      rationale: "Planifiez les prochaines publications pour atteindre la cadence cible sans attendre la fin de période.",
      metric: `${postsPerWeek.toFixed(1)}/sem. / objectif ${goals.posts_per_week_target}/sem.`,
    });
  } else if (postsPerWeek < 2 && periodDays >= 14) {
    addUnique(actions, {
      id: "low-frequency",
      priority: "medium",
      horizon: "Cette semaine",
      title: "Sécuriser un minimum de régularité",
      rationale: "Une cadence trop faible limite la portée organique et l'apprentissage par format.",
      metric: `${postsPerWeek.toFixed(1)} publication/sem.`,
    });
  }

  const platformWithDrop = platforms
    .filter((item) => (item.delta?.engagements ?? 0) <= -25 || (item.delta?.reach ?? 0) <= -25)
    .sort((a, b) => Math.min(a.delta?.engagements ?? 0, a.delta?.reach ?? 0) - Math.min(b.delta?.engagements ?? 0, b.delta?.reach ?? 0))[0];
  if (platformWithDrop) {
    const engagementDrop = platformWithDrop.delta?.engagements ?? 0;
    const reachDrop = platformWithDrop.delta?.reach ?? 0;
    addUnique(actions, {
      id: `platform-drop-${platformWithDrop.platform}`,
      priority: "medium",
      horizon: "Cette semaine",
      title: `Revoir le plan ${PLATFORM_LABELS[platformWithDrop.platform]}`,
      rationale: "La plateforme montre un recul marqué ; vérifiez formats, horaires et fréquence sur les derniers posts.",
      metric: engagementDrop <= reachDrop ? `Engagement ${formatPercent(engagementDrop)}` : `Portée ${formatPercent(reachDrop)}`,
    });
  }

  const bestPlatform = platforms
    .filter((item) => item.totals.engagements > 0 || item.totals.views > 0 || item.totals.reach > 0)
    .map((item) => ({
      ...item,
      rate: computeEngagementRate(item.totals.engagements, item.totals.views, item.totals.reach) ?? 0,
    }))
    .sort((a, b) => b.rate - a.rate)[0];
  if (bestPlatform && bestPlatform.rate >= 3) {
    addUnique(actions, {
      id: `scale-${bestPlatform.platform}`,
      priority: "low",
      horizon: "Ce mois-ci",
      title: `Capitaliser sur ${PLATFORM_LABELS[bestPlatform.platform]}`,
      rationale: "Cette plateforme a le meilleur rendement d'interaction ; transformez ses formats gagnants en prochains contenus.",
      metric: `${bestPlatform.rate.toFixed(1)}% d'engagement`,
    });
  }

  if (!actions.length) {
    addUnique(actions, {
      id: "maintain-review",
      priority: "low",
      horizon: "Cette semaine",
      title: "Maintenir la cadence et documenter les apprentissages",
      rationale: "Les signaux sont stables ; formalisez les formats gagnants pour préparer la prochaine itération.",
      metric: `${totals.posts_count} publications analysées`,
    });
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return actions
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, 5);
}
