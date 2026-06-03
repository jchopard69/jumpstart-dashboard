import { getPostEngagements, getPostVisibility } from "./metrics";
import type { Platform } from "./types";

export type ContentPortfolioInput = {
  platform?: Platform | string | null;
  media_type?: string | null;
  metrics?: unknown;
};

export type ContentPortfolio = {
  postsAnalyzed: number;
  dominantFormat: string | null;
  topPlatform: string | null;
  averageEngagementRate: number | null;
  qualityLabel: "Fort" | "Solide" | "À travailler" | "Signal faible";
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "X",
};

const FORMAT_LABELS: Record<string, string> = {
  video: "Vidéo",
  reel: "Reels",
  reels: "Reels",
  image: "Image",
  carousel_album: "Carrousel",
  carousel: "Carrousel",
  text: "Texte",
  short: "Shorts",
};

function labelFormat(value?: string | null): string {
  if (!value) return "Format non précisé";
  const normalized = value.toLowerCase();
  return FORMAT_LABELS[normalized] ?? value.replace(/_/g, " ");
}

function labelPlatform(value?: string | null): string {
  if (!value) return "Canal non précisé";
  return PLATFORM_LABELS[value] ?? value;
}

export function buildContentPortfolio(posts: ContentPortfolioInput[]): ContentPortfolio {
  const enriched = posts
    .map((post) => {
      const visibility = getPostVisibility(post.metrics as any, post.media_type).value;
      const engagements = getPostEngagements(post.metrics as any);
      return { post, visibility, engagements };
    })
    .filter((item) => item.visibility > 0 || item.engagements > 0);

  if (!enriched.length) {
    return {
      postsAnalyzed: 0,
      dominantFormat: null,
      topPlatform: null,
      averageEngagementRate: null,
      qualityLabel: "Signal faible",
    };
  }

  const formatScores = new Map<string, number>();
  const platformScores = new Map<string, number>();
  let totalVisibility = 0;
  let totalEngagements = 0;

  for (const item of enriched) {
    const format = labelFormat(item.post.media_type);
    const platform = labelPlatform(item.post.platform as string | null | undefined);
    const contribution = item.engagements * 2 + item.visibility;
    formatScores.set(format, (formatScores.get(format) ?? 0) + contribution);
    platformScores.set(platform, (platformScores.get(platform) ?? 0) + contribution);
    totalVisibility += item.visibility;
    totalEngagements += item.engagements;
  }

  const dominantFormat = [...formatScores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const topPlatform = [...platformScores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const averageEngagementRate = totalVisibility > 0 ? (totalEngagements / totalVisibility) * 100 : null;
  const qualityLabel =
    averageEngagementRate == null
      ? "Signal faible"
      : averageEngagementRate >= 5
        ? "Fort"
        : averageEngagementRate >= 2
          ? "Solide"
          : "À travailler";

  return {
    postsAnalyzed: enriched.length,
    dominantFormat,
    topPlatform,
    averageEngagementRate,
    qualityLabel,
  };
}
