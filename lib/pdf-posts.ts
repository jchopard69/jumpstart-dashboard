import { resolveSocialImage, pdfImageDataUrl, type ImagePost } from "./social-image";
import { readPostMetric } from "./monthly-review";
import "server-only";

import { getPostEngagements, getPostVisibilityDetails, hasPostEngagementMeasurement } from "@/lib/metrics";
import { PLATFORM_LABELS, type Platform } from "@/lib/types";

type PdfPostSource = ImagePost & {
  caption?: string | null;
  posted_at?: string | null;
  platform?: string | null;
  thumbnail_url?: string | null;
  media_url?: string | null;
  url?: string | null;
  metrics?: unknown;
  media_type?: string | null;
};

export type PdfPostSummary = {
  caption: string;
  date: string;
  platform: string;
  platformLabel: string;
  thumbnailUrl: string | null;
  url: string | null;
  visibility: {
    label: "Impressions" | "Vues" | "Portée" | "Spectateurs uniques";
    value: number;
  };
  engagements: number | null;
  details?: {label:string;value:number}[];
  engagementRate: number | null;
};

function formatPostDate(value?: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export async function buildPdfPostSummaries(
  posts: PdfPostSource[],
  limit: number
): Promise<PdfPostSummary[]> {
  // Use one metric for the whole network: views first, then the available
  // visibility metric. Never compare views on one post with reach on another.
  const measured = posts.map(post => ({post, details: getPostVisibilityDetails(post.metrics as any)}));
  const metricLabel = (["Vues", "Impressions", "Portée", "Spectateurs uniques"] as const)
    .find(label => measured.some(item => item.details.some(metric => metric.label === label && metric.value > 0)))
    ?? (["Vues", "Impressions", "Portée", "Spectateurs uniques"] as const)
      .find(label => measured.some(item => item.details.some(metric => metric.label === label)));
  if (!metricLabel) return [];
  const ranked = measured.flatMap(item => {
    const metric = item.details.find(detail => detail.label === metricLabel);
    return metric ? [{post: item.post, visibility: {label: metricLabel, value: metric.value}}] : [];
  }).sort((a, b) => b.visibility.value - a.visibility.value
    || getPostEngagements(b.post.metrics as any) - getPostEngagements(a.post.metrics as any)
    || String(b.post.posted_at ?? "").localeCompare(String(a.post.posted_at ?? "")))
    .slice(0, limit);
  const selectedPosts = ranked.map(item => item.post);
  // Bound concurrent downloads, not the number of illustrated publications.
  const thumbnails: (string|null)[] = Array(selectedPosts.length).fill(null);
  let next = 0;
  await Promise.all(Array.from({length:Math.min(4,selectedPosts.length)},async()=>{
    while(next<selectedPosts.length) {
      const index=next++;
      const image = await resolveSocialImage(selectedPosts[index]);
      if (image) thumbnails[index] = await pdfImageDataUrl(image);
    }
  }));

  return selectedPosts.map((post, index) => {
    const visibility = ranked[index].visibility;
    const engagements = hasPostEngagementMeasurement(post.metrics as any) ? getPostEngagements(post.metrics as any) : null;
    const platform = String(post.platform ?? "");
    const knownPlatform = platform as Platform;
    const platformLabel =
      platform && knownPlatform in PLATFORM_LABELS
        ? PLATFORM_LABELS[knownPlatform]
        : platform || "Réseau";

    return {
      caption: post.caption ?? "Publication sans titre",
      date: formatPostDate(post.posted_at),
      platform,
      platformLabel,
      thumbnailUrl: thumbnails[index] ?? null,
      url: post.url ?? null,
      visibility,
      engagements,
      details: [...getPostVisibilityDetails(post.metrics as any).filter(item=>item.label!==visibility.label), ...[{label:"J’aime",keys:["likes","like_count"]},{label:"Commentaires",keys:["comments","comments_count","comment_count"]},{label:"Partages",keys:["shares","share_count","reposts"]},{label:"Enregistrements",keys:["saves","saved","save_count"]}].flatMap(item=>{const value=readPostMetric(post.metrics as Record<string,unknown>,item.keys);return value==null?[]:[{label:item.label,value}];})],
      engagementRate: visibility.value > 0 && engagements != null ? (engagements / visibility.value) * 100 : null,
    };
  });
}
