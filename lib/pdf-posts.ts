import { postPreviewCandidates } from "./post-preview";
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
      headers: { Accept: "image/jpeg, image/png" },
    });
    if (!response.ok) {
      return null;
    }

    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > 8 * 1024 * 1024) {
      return null;
    }

    const buffer = Buffer.from(bytes);
    // React PDF supports JPEG and PNG. Reject other formats so a fallback can be tried.
    const contentType=buffer[0]===0xff&&buffer[1]===0xd8?'image/jpeg':buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':null;
    if(!contentType)return null;
    return `data:${contentType};base64,${buffer.toString("base64")}`;
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
  // Bound concurrent downloads, not the number of illustrated publications.
  const thumbnails: (string|null)[] = Array(selectedPosts.length).fill(null);
  let next = 0;
  await Promise.all(Array.from({length:Math.min(8,selectedPosts.length)},async()=>{
    while(next<selectedPosts.length) {
      const index=next++;
      for(const candidate of postPreviewCandidates(selectedPosts[index])) {
        const image=await resolveThumbnailDataUrl(candidate);
        if(image){thumbnails[index]=image;break;}
      }
    }
  }));

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
