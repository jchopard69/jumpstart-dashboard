import type { DashboardMetric } from "./types/dashboard";

/** Each point is a day, not an account row. Follower stocks carry forward only after an observed value. */
export function buildDailySeries(metrics: DashboardMetric[], key: "followers" | "views" | "reach" | "engagements"): number[] {
  const days = new Map<string, DashboardMetric[]>();
  for (const row of metrics) {
    const group = days.get(row.date) ?? [];
    group.push(row);
    days.set(row.date, group);
  }
  const stocks = new Map<string, number>();
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, rows]) => {
    if (key !== "followers") return rows.reduce((sum, row) => sum + (row[key] ?? 0), 0);
    for (const row of rows) {
      if (row.followers != null && Number.isFinite(row.followers)) stocks.set(row.social_account_id ?? row.platform ?? "unknown", row.followers);
    }
    return [...stocks.values()].reduce((sum, value) => sum + value, 0);
  });
}
