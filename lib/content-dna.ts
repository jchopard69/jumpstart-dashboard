/**
 * JumpStart Content DNA Engine
 *
 * Extracts winning content patterns from top-performing posts.
 * Analyzes: best format, best posting time, caption length impact.
 */

import type { Platform } from "./types";

export type ContentPattern = {
  id: string;
  label: string;
  insight: string;
  detail: string;
  icon: "format" | "clock" | "caption";
  strength: number; // 0-100, confidence in the pattern
};

export type ContentDnaResult = {
  patterns: ContentPattern[];
  topFormat: string | null;
  bestTimeWindow: string | null;
  optimalCaptionLength: string | null;
};

export type ContentDnaInput = {
  posts: Array<{
    platform?: Platform;
    media_type?: string;
    posted_at?: string | null;
    caption?: string | null;
    metrics?: { impressions?: number; views?: number; engagements?: number; likes?: number; comments?: number; shares?: number } | null;
  }>;
};

function normalizeMediaType(type?: string): string {
  if (!type) return "other";
  const lower = type.toLowerCase();
  if (lower.includes("reel")) return "reel";
  if (lower.includes("carousel") || lower.includes("album")) return "carousel";
  if (lower.includes("video")) return "video";
  if (lower.includes("image") || lower.includes("photo")) return "image";
  if (lower.includes("text") || lower.includes("status")) return "text";
  if (lower.includes("link")) return "link";
  return lower;
}

const TYPE_LABELS: Record<string, string> = {
  reel: "Reels", video: "Vidéos", image: "Images",
  carousel: "Carrousels", text: "Publications texte", link: "Liens",
};

function getPostEng(post: ContentDnaInput["posts"][number]): number {
  if (!post.metrics) return 0;
  return post.metrics.engagements ?? (post.metrics.likes ?? 0) + (post.metrics.comments ?? 0) + (post.metrics.shares ?? 0);
}

function getPostViews(post: ContentDnaInput["posts"][number]): number {
  if (!post.metrics) return 0;
  return post.metrics.impressions ?? post.metrics.views ?? 0;
}

/**
 * Analyze top posts and extract 2-3 winning content patterns
 */
export function analyzeContentDna(input: ContentDnaInput): ContentDnaResult {
  const patterns: ContentPattern[] = [];
  const { posts } = input;

  if (posts.length < 3) {
    return { patterns: [], topFormat: null, bestTimeWindow: null, optimalCaptionLength: null };
  }

  const formatPattern = analyzeFormats(posts);
  const timingPattern = analyzeTiming(posts);
  const captionPattern = analyzeCaptionLength(posts);

  if (formatPattern) patterns.push(formatPattern);
  if (timingPattern) patterns.push(timingPattern);
  if (captionPattern) patterns.push(captionPattern);

  // Sort by strength
  patterns.sort((a, b) => b.strength - a.strength);

  return {
    patterns: patterns.slice(0, 3),
    topFormat: formatPattern ? formatPattern.label : null,
    bestTimeWindow: timingPattern ? timingPattern.label : null,
    optimalCaptionLength: captionPattern ? captionPattern.label : null,
  };
}

function analyzeFormats(posts: ContentDnaInput["posts"]): ContentPattern | null {
  const byType = new Map<string, { count: number; totalEng: number; totalViews: number }>();

  for (const post of posts) {
    const type = normalizeMediaType(post.media_type);
    if (type === "other") continue;
    const existing = byType.get(type) ?? { count: 0, totalEng: 0, totalViews: 0 };
    existing.count++;
    existing.totalEng += getPostEng(post);
    existing.totalViews += getPostViews(post);
    byType.set(type, existing);
  }

  const formats = Array.from(byType.entries())
    .filter(([, data]) => data.count >= 2)
    .map(([type, data]) => ({
      type,
      avgEng: data.totalEng / data.count,
      avgViews: data.totalViews / data.count,
      count: data.count,
      share: data.count / posts.length,
    }))
    .sort((a, b) => b.avgEng - a.avgEng);

  if (formats.length < 1) return null;

  const best = formats[0];
  const bestLabel = TYPE_LABELS[best.type] ?? best.type;
  const overall = posts.length > 0
    ? posts.reduce((sum, p) => sum + getPostEng(p), 0) / posts.length
    : 0;
  const multiplier = overall > 0 ? best.avgEng / overall : 1;

  // Strength: how much better is this format vs average
  const strength = Math.min(100, Math.round(50 + multiplier * 20));

  let detail: string;
  if (formats.length >= 2) {
    const secondLabel = TYPE_LABELS[formats[1].type] ?? formats[1].type;
    const ratio = formats[1].avgEng > 0 ? (best.avgEng / formats[1].avgEng).toFixed(1) : "∞";
    detail = `${ratio}x plus d'engagement que les ${secondLabel.toLowerCase()} (${best.count} posts analysés)`;
  } else {
    detail = `${Math.round(best.avgEng)} engagements en moyenne sur ${best.count} publications`;
  }

  return {
    id: "format",
    label: bestLabel,
    insight: `Les ${bestLabel.toLowerCase()} sont votre format gagnant`,
    detail,
    icon: "format",
    strength,
  };
}

function analyzeTiming(posts: ContentDnaInput["posts"]): ContentPattern | null {
  const postsWithTime = posts.filter(p => p.posted_at);
  if (postsWithTime.length < 5) return null;

  // Group into time windows: morning (6-11), lunch (11-14), afternoon (14-18), evening (18-22), night (22-6)
  const windows: Record<string, { label: string; range: string; count: number; totalEng: number }> = {
    morning: { label: "Matin", range: "6h–11h", count: 0, totalEng: 0 },
    lunch: { label: "Midi", range: "11h–14h", count: 0, totalEng: 0 },
    afternoon: { label: "Après-midi", range: "14h–18h", count: 0, totalEng: 0 },
    evening: { label: "Soir", range: "18h–22h", count: 0, totalEng: 0 },
    night: { label: "Nuit", range: "22h–6h", count: 0, totalEng: 0 },
  };

  for (const post of postsWithTime) {
    const hour = new Date(post.posted_at!).getHours();
    let key: string;
    if (hour >= 6 && hour < 11) key = "morning";
    else if (hour >= 11 && hour < 14) key = "lunch";
    else if (hour >= 14 && hour < 18) key = "afternoon";
    else if (hour >= 18 && hour < 22) key = "evening";
    else key = "night";

    windows[key].count++;
    windows[key].totalEng += getPostEng(post);
  }

  const ranked = Object.values(windows)
    .filter(w => w.count >= 2)
    .map(w => ({ ...w, avgEng: w.totalEng / w.count }))
    .sort((a, b) => b.avgEng - a.avgEng);

  if (ranked.length < 2) return null;

  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const ratio = worst.avgEng > 0 ? best.avgEng / worst.avgEng : 2;

  if (ratio < 1.3) return null; // Not significant enough

  const strength = Math.min(100, Math.round(40 + ratio * 15));

  return {
    id: "timing",
    label: best.range,
    insight: `Le créneau ${best.label.toLowerCase()} (${best.range}) performe le mieux`,
    detail: `${Math.round(best.avgEng)} engagements en moyenne vs ${Math.round(worst.avgEng)} le ${worst.label.toLowerCase()} (${best.count} posts)`,
    icon: "clock",
    strength,
  };
}

function analyzeCaptionLength(posts: ContentDnaInput["posts"]): ContentPattern | null {
  const postsWithCaption = posts.filter(p => p.caption && p.caption.length > 0);
  if (postsWithCaption.length < 5) return null;

  // Group by caption length: short (<80), medium (80-250), long (250+)
  const buckets: Record<string, { label: string; range: string; count: number; totalEng: number }> = {
    short: { label: "Courtes", range: "< 80 caractères", count: 0, totalEng: 0 },
    medium: { label: "Moyennes", range: "80–250 caractères", count: 0, totalEng: 0 },
    long: { label: "Longues", range: "250+ caractères", count: 0, totalEng: 0 },
  };

  for (const post of postsWithCaption) {
    const len = post.caption!.length;
    let key: string;
    if (len < 80) key = "short";
    else if (len < 250) key = "medium";
    else key = "long";

    buckets[key].count++;
    buckets[key].totalEng += getPostEng(post);
  }

  const ranked = Object.entries(buckets)
    .filter(([, b]) => b.count >= 2)
    .map(([key, b]) => ({ key, ...b, avgEng: b.totalEng / b.count }))
    .sort((a, b) => b.avgEng - a.avgEng);

  if (ranked.length < 2) return null;

  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const ratio = worst.avgEng > 0 ? best.avgEng / worst.avgEng : 1.5;

  if (ratio < 1.2) return null; // Not significant

  const strength = Math.min(100, Math.round(35 + ratio * 15));

  const labels: Record<string, string> = {
    short: "courtes (< 80 car.)",
    medium: "moyennes (80–250 car.)",
    long: "longues (250+ car.)",
  };

  return {
    id: "caption",
    label: `Captions ${best.label.toLowerCase()}`,
    insight: `Les légendes ${labels[best.key]} génèrent plus d'engagement`,
    detail: `${Math.round(best.avgEng)} engagements moyen vs ${Math.round(worst.avgEng)} pour les légendes ${labels[worst.key]}`,
    icon: "caption",
    strength,
  };
}
