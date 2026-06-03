/** Returns true if the value is a finite number (not null/undefined/NaN) */
export function metricAvailable(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value !== 0;
}

/**
 * Compute engagement rate with views > reach fallback.
 * Returns null when data is insufficient (both views and reach are 0).
 */
export function computeEngagementRate(
  engagements: number,
  views: number,
  reach: number
): number | null {
  if (views > 0) return (engagements / views) * 100;
  if (reach > 0) return (engagements / reach) * 100;
  return null;
}

export function coerceMetric(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.includes("/")) {
      const parts = trimmed.split("/").map((part) => Number(part.replace(/[^\d-]/g, "")));
      const valid = parts.filter((part) => Number.isFinite(part));
      if (valid.length) {
        return Math.max(...valid);
      }
    }
    const digits = trimmed.replace(/[^\d-]/g, "");
    if (!digits || digits === "-") return 0;
    const parsed = Number(digits);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

type MetricRecord = Record<string, unknown> | null | undefined;

function normalizeMetricRecord(metrics: MetricRecord): MetricRecord {
  if (typeof metrics !== "string") return metrics;
  try {
    const parsed = JSON.parse(metrics);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : metrics;
  } catch {
    return metrics;
  }
}

function isReelMediaType(mediaType: unknown): boolean {
  if (typeof mediaType !== "string") return false;
  const normalized = mediaType.trim().toLowerCase();
  return normalized === "reel" || normalized.includes("reel");
}

export function getPostImpressions(metrics: MetricRecord): number {
  const normalized = normalizeMetricRecord(metrics);
  if (typeof normalized === "string") {
    return coerceMetric(normalized);
  }
  return coerceMetric(
    normalized?.impressions ??
    normalized?.impression_count ??
    normalized?.views ??
    normalized?.view_count ??
    normalized?.reach ??
    normalized?.reach_count ??
    normalized?.media_views ??
    normalized?.plays ??
    normalized?.play_count ??
    normalized?.video_views ??
    normalized?.video_view_count ??
    0
  );
}

export function getPostEngagements(metrics: MetricRecord): number {
  const normalized = normalizeMetricRecord(metrics);
  if (typeof normalized === "string") {
    return 0;
  }
  if (normalized?.engagements != null) {
    return coerceMetric(normalized.engagements);
  }
  return (
    coerceMetric(normalized?.likes ?? normalized?.like_count ?? 0) +
    coerceMetric(normalized?.comments ?? normalized?.comment_count ?? normalized?.comments_count ?? 0) +
    coerceMetric(normalized?.shares ?? normalized?.share_count ?? 0) +
    coerceMetric(normalized?.saves ?? normalized?.save_count ?? normalized?.favorite_count ?? 0) +
    coerceMetric(normalized?.reposts ?? normalized?.repost_count ?? 0)
  );
}

export function getPostVisibility(
  metrics: MetricRecord,
  mediaType?: unknown
): { label: "Impressions" | "Vues" | "Portée"; value: number } {
  const normalized = normalizeMetricRecord(metrics);
  if (typeof normalized === "string") {
    return { label: "Impressions", value: coerceMetric(normalized) };
  }
  const impressions = coerceMetric(normalized?.impressions ?? normalized?.impression_count ?? 0);
  const views = coerceMetric(
    normalized?.views ??
    normalized?.view_count ??
    normalized?.media_views ??
    normalized?.plays ??
    normalized?.play_count ??
    normalized?.video_views ??
    normalized?.video_view_count ??
    0
  );
  if (isReelMediaType(mediaType) && views > 0) {
    return { label: "Vues", value: views };
  }
  if (impressions > 0) return { label: "Impressions", value: impressions };
  if (views > 0) return { label: "Vues", value: views };
  const reach = coerceMetric(normalized?.reach ?? normalized?.reach_count ?? 0);
  return { label: "Portée", value: reach };
}
