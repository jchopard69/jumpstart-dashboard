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

const METRIC_ALERT_CONFIG: Record<MetricKey, MetricAlertConfig> = {
  followers: {
    label: "Abonnes",
    minPreviousValue: 100,
    minDropPercent: 5,
  },
  views: {
    label: "Vues",
    minPreviousValue: 100,
    minDropPercent: 20,
  },
  reach: {
    label: "Portee",
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

  const plural = drops.length > 1 ? "Les metriques suivantes reculent" : "Une baisse notable est detectee";
  const message = `${plural} par rapport a la periode precedente : ${summary}.`;

  return {
    title: "Baisse de performance detectee",
    message,
    metadata: {
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
    message: `Le score passe de ${previousScore}/100 a ${currentScore}/100 (${dropPoints} points)${gradeSuffix}.`,
    metadata: {
      previous_score: previousScore,
      current_score: currentScore,
      drop_points: dropPoints,
      previous_grade: previousGrade,
      current_grade: currentGrade,
    },
  };
}
