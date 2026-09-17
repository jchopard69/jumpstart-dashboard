import type { DashboardMetric } from "./types/dashboard";

type Availability = { views: boolean; reach: boolean; engagements: boolean };
type DailyRow = { date: string; followers: number | null; views: number | null; reach: number | null; engagements: number | null };

/** Preserve missing measurements: a day with no observed value is not a measured zero. */
export function buildReportDailyRows(metrics: DashboardMetric[], platform: string, available?: Availability): DailyRow[] {
  const days = new Map<string, { stocks: Map<string, number>; values: DailyRow }>();
  for (const metric of metrics) {
    if (metric.platform !== platform) continue;
    const day = days.get(metric.date) ?? { stocks: new Map<string, number>(), values: { date: metric.date, followers: null, views: null, reach: null, engagements: null } };
    if (metric.followers != null && Number.isFinite(metric.followers)) day.stocks.set(metric.social_account_id ?? "account", metric.followers);
    for (const key of ["views", "reach", "engagements"] as const) {
      const value = metric[key];
      if (available?.[key] === false || (key === "reach" && ["tiktok", "youtube"].includes(platform))) continue;
      if (value != null && Number.isFinite(value)) day.values[key] = (day.values[key] ?? 0) + value;
    }
    days.set(metric.date, day);
  }
  return [...days.values()].map(day => ({ ...day.values, followers: day.stocks.size ? [...day.stocks.values()].reduce((sum, value) => sum + value, 0) : null }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
