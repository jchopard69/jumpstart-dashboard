type MetricKey = "followers" | "views" | "reach" | "engagements";

type MetricTotals = Record<MetricKey, number>;

type MetricAlertConfig = {
  label: string;
  minPreviousValue: number;
  minDropPercent: number;
};

export type MetricDropDetail = {
  key: MetricKey;
  label: string;
  previous: number;
  current: number;
  dropPercent: number;
};

function buildMetricDropRecommendation(drops: MetricDropDetail[]) {
  const keys = new Set(drops.map((drop) => drop.key));
  if (keys.has("engagements")) {
    return {
      action: "Comparer les contenus récents avec les formats les plus engageants et préparer une variante plus interactive.",
      href: "#dashboard-content",
    };
  }
  if (keys.has("reach") || keys.has("views")) {
    return {
      action: "Vérifier les meilleurs créneaux, formats visibles et opportunités de repost ou amplification.",
      href: "#dashboard-content",
    };
  }
  if (keys.has("followers")) {
    return {
      action: "Contrôler les contenus récents et relancer une séquence d'acquisition ou de réassurance.",
      href: "#dashboard-kpis",
    };
  }
  return {
    action: "Ouvrir le dashboard pour prioriser le plan d'actions de la période.",
    href: "#dashboard-priorities",
  };
}

const METRIC_ALERT_CONFIG: Record<MetricKey, MetricAlertConfig> = {
  followers: {
    label: "Abonnés",
    minPreviousValue: 100,
    minDropPercent: 5,
  },
  views: {
    label: "Vues",
    minPreviousValue: 100,
    minDropPercent: 20,
  },
  reach: {
    label: "Portée",
    minPreviousValue: 100,
    minDropPercent: 20,
  },
  engagements: {
    label: "Engagements",
    minPreviousValue: 50,
    minDropPercent: 20,
  },
};

function calculatePercentChange(current: number, previous: number): number {
  if (previous <= 0) return 0;
  return ((current - previous) / previous) * 100;
}

export function detectMetricDrops(params: {
  current: MetricTotals;
  previous: MetricTotals;
}): MetricDropDetail[] {
  const details: MetricDropDetail[] = [];

  for (const key of Object.keys(METRIC_ALERT_CONFIG) as MetricKey[]) {
    const config = METRIC_ALERT_CONFIG[key];
    const previous = Math.max(0, params.previous[key] ?? 0);
    const current = Math.max(0, params.current[key] ?? 0);

    if (previous < config.minPreviousValue) {
      continue;
    }

    const dropPercent = calculatePercentChange(current, previous);
    if (dropPercent > -config.minDropPercent) {
      continue;
    }

    details.push({
      key,
      label: config.label,
      previous,
      current,
      dropPercent,
    });
  }

  return details.sort((a, b) => a.dropPercent - b.dropPercent);
}

export function buildMetricDropAlert(params: {
  current: MetricTotals;
  previous: MetricTotals;
}): {
  title: string;
  message: string;
  metadata: Record<string, unknown>;
} | null {
  const drops = detectMetricDrops(params);
  if (drops.length === 0) {
    return null;
  }

  const summary = drops
    .slice(0, 3)
    .map((detail) => `${detail.label.toLowerCase()} ${Math.round(detail.dropPercent)}%`)
    .join(", ");

  const severeDrops = drops.filter((detail) => detail.dropPercent <= -35);
  const plural = drops.length > 1 ? "Les métriques suivantes reculent" : "Une baisse notable est détectée";
  const message = `${plural} par rapport à la période précédente : ${summary}.`;
  const recommendation = buildMetricDropRecommendation(drops);

  return {
    title: severeDrops.length > 0 ? "Baisse de performance prioritaire" : "Baisse de performance détectée",
    message,
    metadata: {
      severity: severeDrops.length > 0 ? "high" : "medium",
      recommended_action: recommendation.action,
      recommended_href: recommendation.href,
      metrics: drops.map((detail) => ({
        key: detail.key,
        label: detail.label,
        previous: detail.previous,
        current: detail.current,
        drop_percent: Math.round(detail.dropPercent * 10) / 10,
      })),
    },
  };
}

export function buildScoreDropAlert(params: {
  currentScore: number;
  previousScore: number | null;
  currentGrade?: string | null;
  previousGrade?: string | null;
  minAbsoluteDrop?: number;
}): {
  title: string;
  message: string;
  metadata: Record<string, unknown>;
} | null {
  const {
    currentScore,
    previousScore,
    currentGrade = null,
    previousGrade = null,
    minAbsoluteDrop = 8,
  } = params;

  if (previousScore === null || previousScore <= 0) {
    return null;
  }

  const dropPoints = currentScore - previousScore;
  if (dropPoints > -minAbsoluteDrop) {
    return null;
  }

  const gradeSuffix =
    currentGrade && previousGrade
      ? ` (${previousGrade} -> ${currentGrade})`
      : "";

  return {
    title: "Score JumpStart en baisse",
    message: `Le score passe de ${previousScore}/100 à ${currentScore}/100 (${dropPoints} points)${gradeSuffix}.`,
    metadata: {
      severity: dropPoints <= -15 ? "high" : "medium",
      recommended_action: "Analyser les sous-scores, la qualité des données et les priorités du plan d'actions.",
      recommended_href: "#dashboard-priorities",
      previous_score: previousScore,
      current_score: currentScore,
      drop_points: dropPoints,
      previous_grade: previousGrade,
      current_grade: currentGrade,
    },
  };
}
