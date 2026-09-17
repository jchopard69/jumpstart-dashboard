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

export function hasPostEngagementMeasurement(metrics: MetricRecord): boolean {
  const normalized = normalizeMetricRecord(metrics);
  if (!normalized || typeof normalized !== "object") return false;
  return ["engagements", "likes", "like_count", "comments", "comment_count", "comments_count", "shares", "share_count", "saves", "save_count", "saved", "favorite_count", "reposts", "repost_count"]
    .some(key => {
      const value = normalized[key];
      return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
    });
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
    coerceMetric(normalized?.saves ?? normalized?.save_count ?? normalized?.saved ?? normalized?.favorite_count ?? 0) +
    coerceMetric(normalized?.reposts ?? normalized?.repost_count ?? 0)
  );
}

export function getPostVisibility(
  metrics: MetricRecord,
  mediaType?: unknown,
  platform?: string | null
): { label: "Impressions" | "Vues" | "Portée" | "Spectateurs uniques"; value: number } {
  const normalized = normalizeMetricRecord(metrics);
  if (typeof normalized === "string") {
    return { label: "Impressions", value: coerceMetric(normalized) };
  }
  const positive = (keys: string[]) => {
    for (const key of keys) { const value=coerceMetric(normalized?.[key]); if(value>0)return value; }
    return 0;
  };
  const impressions = positive(["impressions","impression_count"]);
  const views = positive(["views","view_count","media_views","plays","play_count","video_views","video_view_count"]);
  if ((isReelMediaType(mediaType) || platform === 'facebook' || platform === 'instagram') && views > 0) {
    return { label: "Vues", value: views };
  }
  if (impressions > 0) return { label: "Impressions", value: impressions };
  if (views > 0) return { label: "Vues", value: views };
  const reach = positive(["reach","reach_count"]);
  if (reach > 0) return { label: "Portée", value: reach };
  const viewers = positive(['viewers']);
  if (viewers > 0) return { label: "Spectateurs uniques", value: viewers };
  return { label: "Portée", value: 0 };
}

export type PostVisibilityDetail = { label: string; value: number; collectedAt?: number };
export function getPostVisibilityDetails(metrics: MetricRecord): PostVisibilityDetail[] {
  const values = normalizeMetricRecord(metrics);
  if (!values || typeof values !== 'object') return [];
  return [
    { label: 'Vues', keys: ['views','view_count','media_views','plays','play_count','video_views','video_view_count'] },
    { label: 'Portée', keys: ['reach','reach_count'] },
    { label: 'Impressions', keys: ['impressions','impression_count'] },
    { label: 'Spectateurs uniques', keys: ['viewers'] },
  ].flatMap(({label, keys}) => {
    for (const key of keys) {
      const value = values[key];
      const collectedAt = typeof values[`_${key}_collected_at`] === 'number' ? values[`_${key}_collected_at`] as number : undefined;
      // Legacy storage generated zeros for absent metrics. Only dated API zeros are trusted.
      if (typeof value === 'number' && Number.isFinite(value) && (value > 0 || (value === 0 && collectedAt && label !== 'Portée'))) return [{label, value, collectedAt}];
    }
    return [];
  });
}
