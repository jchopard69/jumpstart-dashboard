import type { Platform } from "./types";

type MetricAvailability = {
  views: boolean;
  reach: boolean;
  engagements: boolean;
};

type MetricTotals = {
  views: number;
  reach: number;
  engagements: number;
};

const DEFAULT_METRIC_AVAILABILITY: Record<Platform, MetricAvailability> = {
  facebook: { views: true, reach: true, engagements: true },
  instagram: { views: true, reach: true, engagements: true },
  linkedin: { views: false, reach: true, engagements: true },
  tiktok: { views: true, reach: true, engagements: true },
  youtube: { views: true, reach: true, engagements: true },
  twitter: { views: false, reach: false, engagements: false },
};

export function getDashboardMetricAvailability(
  platform: Platform,
  currentTotals: MetricTotals,
  previousTotals: MetricTotals
): MetricAvailability {
  const defaults = DEFAULT_METRIC_AVAILABILITY[platform];

  return {
    views: defaults.views || currentTotals.views > 0 || previousTotals.views > 0,
    reach: defaults.reach || currentTotals.reach > 0 || previousTotals.reach > 0,
    engagements:
      defaults.engagements || currentTotals.engagements > 0 || previousTotals.engagements > 0,
  };
}
