import { readPostMetric } from "./monthly-review";
import "server-only";

import { getPostEngagements, getPostVisibility, hasPostEngagementMeasurement } from "@/lib/metrics";
import { selectDisplayTopPosts } from "@/lib/top-posts";
import { PLATFORM_LABELS, type Platform } from "@/lib/types";

type PdfPostSource = {
  caption?: string | null;
  posted_at?: string | null;
  platform?: string | null;
  thumbnail_url?: string | null;
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
    label: "Impressions" | "Vues" | "Portée";
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

function inferMimeType(url: string): string {
  const normalized = url.toLowerCase();
  if (normalized.includes(".png")) return "image/png";
  if (normalized.includes(".webp")) return "image/webp";
  if (normalized.includes(".gif")) return "image/gif";
  return "image/jpeg";
}

async function resolveThumbnailDataUrl(url?: string | null): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:image/")) {
    return url;
  }
  if (!/^https?:\/\//i.test(url)) {
    return null;
  }

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }

    const contentTypeHeader = response.headers.get("content-type") ?? "";
    const contentType = contentTypeHeader.startsWith("image/")
      ? contentTypeHeader.split(";")[0]
      : inferMimeType(url);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0) {
      return null;
    }

    return `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}

export async function buildPdfPostSummaries(
  posts: PdfPostSource[],
  limit: number
): Promise<PdfPostSummary[]> {
  const ranked = selectDisplayTopPosts(posts, posts.length);
  const selectedPosts = [...ranked, ...posts.filter(post => !ranked.includes(post))].slice(0, limit);
  const thumbnails = await Promise.all(
    selectedPosts.map((post,index) => index < 15 ? resolveThumbnailDataUrl(post.thumbnail_url) : Promise.resolve(null))
  );

  return selectedPosts.map((post, index) => {
    const visibility = getPostVisibility(post.metrics as any, post.media_type);
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
      details: [{label:"J’aime",keys:["likes","like_count"]},{label:"Commentaires",keys:["comments","comments_count","comment_count"]},{label:"Partages",keys:["shares","share_count","reposts"]},{label:"Enregistrements",keys:["saves","saved","save_count"]}].flatMap(item=>{const value=readPostMetric(post.metrics as Record<string,unknown>,item.keys);return value==null?[]:[{label:item.label,value}];}),
      engagementRate: visibility.value > 0 && engagements != null ? (engagements / visibility.value) * 100 : null,
    };
  });
}
