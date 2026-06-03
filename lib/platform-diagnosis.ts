import { computeEngagementRate } from "./metrics";
import type { Platform } from "./types";
import type { PlatformData } from "./types/dashboard";

type PlatformDiagnosisInput = Omit<PlatformData, "available"> & {
  available?: PlatformData["available"];
};

export type PlatformDiagnosisItem = {
  platform: Platform;
  label: string;
  value: string;
  detail: string;
  tone: "strong" | "watch" | "balance";
};

export type PlatformDiagnosis = {
  primary: PlatformDiagnosisItem | null;
  watch: PlatformDiagnosisItem | null;
  balance: PlatformDiagnosisItem | null;
};

const PLATFORM_NAMES: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "X",
};

function formatPercent(value: number, digits = 0): string {
  return `${value.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}K`;
  if (value >= 1_000) return `${(value / 1000).toFixed(1).replace(".0", "")}K`;
  return value.toLocaleString("fr-FR");
}

function visibilityVolume(platform: PlatformDiagnosisInput): number {
  return platform.totals.reach || platform.totals.views || 0;
}

function platformScore(platform: PlatformDiagnosisInput, maxVisibility: number, maxEngagements: number): number {
  const visibility = visibilityVolume(platform);
  const visibilityScore = maxVisibility > 0 ? visibility / maxVisibility : 0;
  const engagementScore = maxEngagements > 0 ? platform.totals.engagements / maxEngagements : 0;
  const rate = computeEngagementRate(platform.totals.engagements, platform.totals.views, platform.totals.reach) ?? 0;
  const rateScore = Math.min(rate / 5, 1);
  const deltaScore = Math.max(-0.2, Math.min(0.2, (platform.delta?.engagements ?? 0) / 100));

  return visibilityScore * 0.35 + engagementScore * 0.45 + rateScore * 0.2 + deltaScore;
}

export function buildPlatformDiagnosis(platforms: PlatformDiagnosisInput[]): PlatformDiagnosis {
  const activePlatforms = platforms.filter((platform) =>
    platform.totals.posts_count > 0 ||
    platform.totals.engagements > 0 ||
    visibilityVolume(platform) > 0
  );

  if (activePlatforms.length === 0) {
    return { primary: null, watch: null, balance: null };
  }

  const maxVisibility = Math.max(0, ...activePlatforms.map(visibilityVolume));
  const maxEngagements = Math.max(0, ...activePlatforms.map((platform) => platform.totals.engagements));
  const totalVisibility = activePlatforms.reduce((sum, platform) => sum + visibilityVolume(platform), 0);
  const totalEngagements = activePlatforms.reduce((sum, platform) => sum + platform.totals.engagements, 0);

  const ranked = [...activePlatforms].sort((a, b) =>
    platformScore(b, maxVisibility, maxEngagements) - platformScore(a, maxVisibility, maxEngagements)
  );
  const primaryPlatform = ranked[0];
  const primaryVisibilityShare = totalVisibility > 0 ? (visibilityVolume(primaryPlatform) / totalVisibility) * 100 : 0;
  const primaryEngagementShare = totalEngagements > 0 ? (primaryPlatform.totals.engagements / totalEngagements) * 100 : 0;
  const primaryRate = computeEngagementRate(
    primaryPlatform.totals.engagements,
    primaryPlatform.totals.views,
    primaryPlatform.totals.reach
  );

  const primary: PlatformDiagnosisItem = {
    platform: primaryPlatform.platform,
    label: "Canal moteur",
    value: PLATFORM_NAMES[primaryPlatform.platform],
    detail: `${formatPercent(primaryEngagementShare)} des engagements${primaryRate != null ? `, taux ${formatPercent(primaryRate, 1)}` : ""}.`,
    tone: "strong",
  };

  const watchCandidates = activePlatforms
    .filter((platform) => platform.platform !== primaryPlatform.platform)
    .map((platform) => {
      const rate = computeEngagementRate(platform.totals.engagements, platform.totals.views, platform.totals.reach) ?? 0;
      const reachMissingPenalty = platform.totals.posts_count > 0 && platform.available?.reach === false && platform.totals.reach === 0 ? 1 : 0;
      const negativeDelta = Math.max(0, -(platform.delta?.engagements ?? 0) / 100);
      const lowRate = rate > 0 && rate < 1 ? 0.6 : 0;
      const lowVisibility = visibilityVolume(platform) === 0 && platform.totals.posts_count > 0 ? 0.8 : 0;
      return {
        platform,
        rate,
        score: reachMissingPenalty + negativeDelta + lowRate + lowVisibility,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const watchPlatform = watchCandidates[0]?.platform;
  const watch: PlatformDiagnosisItem | null = watchPlatform
    ? {
        platform: watchPlatform.platform,
        label: "Canal à surveiller",
        value: PLATFORM_NAMES[watchPlatform.platform],
        detail:
          watchPlatform.available?.reach === false && watchPlatform.totals.posts_count > 0
            ? "Portée indisponible : lecture de visibilité à consolider."
            : `${formatCompact(watchPlatform.totals.engagements)} engagements, variation ${formatPercent(watchPlatform.delta?.engagements ?? 0)}.`,
        tone: "watch",
      }
    : null;

  const balance: PlatformDiagnosisItem | null = activePlatforms.length > 1
    ? {
        platform: primaryPlatform.platform,
        label: "Mix de canaux",
        value: primaryVisibilityShare >= 70 ? "Concentré" : primaryVisibilityShare >= 45 ? "Dominante claire" : "Équilibré",
        detail: `${PLATFORM_NAMES[primaryPlatform.platform]} représente ${formatPercent(primaryVisibilityShare)} de la visibilité totale.`,
        tone: "balance",
      }
    : null;

  return { primary, watch, balance };
}
