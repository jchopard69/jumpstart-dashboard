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
    normalized?.views ??
    normalized?.reach ??
    normalized?.media_views ??
    normalized?.plays ??
    normalized?.video_views ??
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
    coerceMetric(normalized?.likes ?? 0) +
    coerceMetric(normalized?.comments ?? 0) +
    coerceMetric(normalized?.shares ?? 0) +
    coerceMetric(normalized?.saves ?? 0)
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
  const impressions = coerceMetric(normalized?.impressions ?? 0);
  const views = coerceMetric(
    normalized?.views ??
    normalized?.media_views ??
    normalized?.plays ??
    normalized?.video_views ??
    0
  );
  if (isReelMediaType(mediaType) && views > 0) {
    return { label: "Vues", value: views };
  }
  if (impressions > 0) return { label: "Impressions", value: impressions };
  if (views > 0) return { label: "Vues", value: views };
  const reach = coerceMetric(normalized?.reach ?? 0);
  return { label: "Portée", value: reach };
}
