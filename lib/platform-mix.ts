import { computeEngagementRate } from "./metrics";
import type { PlatformData } from "./types/dashboard";

type PlatformMixInput = Pick<PlatformData, "platform" | "totals">;

export type PlatformMixItem = {
  platform: string;
  visibilityShare: number;
  engagementShare: number;
  engagementRate: number | null;
  postsShare: number;
  role: string;
  summary: string;
};

export type PlatformMix = {
  items: PlatformMixItem[];
  leader?: string;
  concentrationLabel: string;
};

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function getVisibilityTotal(item: PlatformMixInput): number {
  return item.totals.views > 0 ? item.totals.views : item.totals.reach;
}

function buildRole(item: PlatformMixItem): string {
  if (item.engagementShare >= 45) return "Moteur relationnel";
  if (item.visibilityShare >= 45) return "Moteur de visibilité";
  if (item.engagementRate != null && item.engagementRate >= 4) return "Canal de rendement";
  if (item.postsShare >= 45) return "Canal de volume";
  return "Canal d'appui";
}

export function buildPlatformMix(perPlatform: PlatformMixInput[]): PlatformMix {
  const visibilityTotal = perPlatform.reduce((sum, item) => sum + getVisibilityTotal(item), 0);
  const engagementTotal = perPlatform.reduce((sum, item) => sum + item.totals.engagements, 0);
  const postsTotal = perPlatform.reduce((sum, item) => sum + item.totals.posts_count, 0);

  const items = perPlatform
    .map((item) => {
      const visibilityShare = visibilityTotal > 0 ? (getVisibilityTotal(item) / visibilityTotal) * 100 : 0;
      const engagementShare = engagementTotal > 0 ? (item.totals.engagements / engagementTotal) * 100 : 0;
      const postsShare = postsTotal > 0 ? (item.totals.posts_count / postsTotal) * 100 : 0;
      const engagementRate = computeEngagementRate(
        item.totals.engagements,
        item.totals.views,
        item.totals.reach
      );
      const draft = {
        platform: item.platform,
        visibilityShare,
        engagementShare,
        engagementRate,
        postsShare,
        role: "",
        summary: "",
      };
      const role = buildRole(draft);
      const summary = `${formatPercent(visibilityShare)} de la visibilité, ${formatPercent(engagementShare)} de l'engagement.`;
      return { ...draft, role, summary };
    })
    .sort((a, b) => {
      const aScore = a.visibilityShare + a.engagementShare * 1.2;
      const bScore = b.visibilityShare + b.engagementShare * 1.2;
      return bScore - aScore;
    });

  const leader = items[0]?.platform;
  const topShare = Math.max(items[0]?.visibilityShare ?? 0, items[0]?.engagementShare ?? 0);
  const concentrationLabel =
    items.length <= 1
      ? "Lecture mono-canal"
      : topShare >= 70
        ? "Mix très concentré"
        : topShare >= 45
          ? "Mix assumé"
          : "Mix équilibré";

  return {
    items,
    leader,
    concentrationLabel,
  };
}
