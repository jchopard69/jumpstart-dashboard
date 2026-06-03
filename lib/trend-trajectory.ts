export type TrendTrajectoryPoint = {
  date: string;
  value: number;
};

export type TrendTrajectoryItem = {
  id: string;
  label: string;
  valueLabel: string;
  changeLabel: string;
  direction: "up" | "down" | "flat";
  summary: string;
  bars: number[];
};

export type TrendTrajectoryInput = {
  id: string;
  label: string;
  points: TrendTrajectoryPoint[];
  mode?: "stock" | "flow";
};

export type TrendTrajectoryMetricRow = {
  date?: string | null;
  social_account_id?: string | null;
  followers?: number | null;
  views?: number | null;
  reach?: number | null;
  engagements?: number | null;
};

function formatCompact(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    notation: "compact",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(Math.round(value));
}

function formatChange(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "stable";
  const sign = value > 0 ? "+" : "";
  const digits = Math.abs(value) < 10 ? 1 : 0;
  return `${sign}${value.toFixed(digits).replace(".", ",")}%`;
}

function normalizeBars(values: number[], slots = 8): number[] {
  if (!values.length) return [];
  const bucketSize = Math.max(1, Math.ceil(values.length / slots));
  const buckets: number[] = [];
  for (let index = 0; index < values.length; index += bucketSize) {
    const slice = values.slice(index, index + bucketSize);
    buckets.push(slice.reduce((sum, value) => sum + value, 0) / slice.length);
  }

  const max = Math.max(...buckets);
  if (max <= 0) return buckets.map(() => 8);
  return buckets.map((value) => Math.max(8, Math.round((value / max) * 100)));
}

export function buildTrendTrajectory(input: TrendTrajectoryInput[]): TrendTrajectoryItem[] {
  return input
    .map((series) => ({
      ...series,
      points: series.points.filter((point) => Number.isFinite(point.value)),
    }))
    .filter((series) => series.points.length > 0)
    .map((series) => {
      const values = series.points.map((point) => Math.max(0, point.value));
      const first = values[0] ?? 0;
      const last = values[values.length - 1] ?? 0;
      const total = values.reduce((sum, value) => sum + value, 0);
      const mode = series.mode ?? "flow";
      const reference = mode === "stock" ? last : total;
      const comparisonBase = mode === "stock" ? first : total / Math.max(1, values.length);
      const change = comparisonBase > 0 ? ((last - comparisonBase) / comparisonBase) * 100 : 0;
      const direction = change > 2 ? "up" : change < -2 ? "down" : "flat";
      const summary =
        direction === "up"
          ? "Traction en hausse en fin de période"
          : direction === "down"
            ? "Rythme à relancer sur la fin de période"
            : "Rythme régulier sur la période";

      return {
        id: series.id,
        label: series.label,
        valueLabel: formatCompact(reference),
        changeLabel: formatChange(change),
        direction,
        summary,
        bars: normalizeBars(values),
      };
    });
}

export function buildTrendTrajectoryFromDailyMetrics(rows: TrendTrajectoryMetricRow[]): TrendTrajectoryItem[] {
  const sortedDates = Array.from(
    new Set(rows.map((row) => row.date).filter((date): date is string => Boolean(date)))
  ).sort();

  const flowsByDate = new Map<string, { views: number; reach: number; engagements: number }>();
  const followersByAccount = new Map<string, Array<{ date: string; followers: number }>>();

  for (const row of rows) {
    if (!row.date) continue;
    const flow = flowsByDate.get(row.date) ?? { views: 0, reach: 0, engagements: 0 };
    flow.views += row.views ?? 0;
    flow.reach += row.reach ?? 0;
    flow.engagements += row.engagements ?? 0;
    flowsByDate.set(row.date, flow);

    if (row.social_account_id && row.followers != null) {
      const accountRows = followersByAccount.get(row.social_account_id) ?? [];
      accountRows.push({ date: row.date, followers: row.followers });
      followersByAccount.set(row.social_account_id, accountRows);
    }
  }

  for (const accountRows of followersByAccount.values()) {
    accountRows.sort((a, b) => a.date.localeCompare(b.date));
  }

  const followersByDate = new Map<string, number>();
  const cursors = new Map<string, { index: number; last: number }>();
  for (const accountId of followersByAccount.keys()) {
    cursors.set(accountId, { index: 0, last: 0 });
  }

  for (const date of sortedDates) {
    let total = 0;
    for (const [accountId, accountRows] of followersByAccount.entries()) {
      const cursor = cursors.get(accountId)!;
      while (cursor.index < accountRows.length && accountRows[cursor.index].date <= date) {
        cursor.last = accountRows[cursor.index].followers;
        cursor.index++;
      }
      total += cursor.last;
    }
    followersByDate.set(date, total);
  }

  return buildTrendTrajectory([
    {
      id: "followers",
      label: "Abonnés",
      mode: "stock",
      points: sortedDates.map((date) => ({ date, value: followersByDate.get(date) ?? 0 })),
    },
    {
      id: "views",
      label: "Vues",
      points: sortedDates.map((date) => ({ date, value: flowsByDate.get(date)?.views ?? 0 })),
    },
    {
      id: "engagements",
      label: "Engagements",
      points: sortedDates.map((date) => ({ date, value: flowsByDate.get(date)?.engagements ?? 0 })),
    },
    {
      id: "reach",
      label: "Portée",
      points: sortedDates.map((date) => ({ date, value: flowsByDate.get(date)?.reach ?? 0 })),
    },
  ]);
}
