export function coerceMetric(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const digits = value.replace(/[^\d-]/g, "");
    if (!digits || digits === "-") return 0;
    const parsed = Number(digits);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

type MetricRecord = Record<string, unknown> | null | undefined;

export function getPostImpressions(metrics: MetricRecord): number {
  return coerceMetric(
    metrics?.impressions ??
    metrics?.views ??
    metrics?.reach ??
    metrics?.plays ??
    metrics?.video_views ??
    0
  );
}

export function getPostEngagements(metrics: MetricRecord): number {
  if (metrics?.engagements != null) {
    return coerceMetric(metrics.engagements);
  }
  return (
    coerceMetric(metrics?.likes ?? 0) +
    coerceMetric(metrics?.comments ?? 0) +
    coerceMetric(metrics?.shares ?? 0) +
    coerceMetric(metrics?.saves ?? 0)
  );
}
