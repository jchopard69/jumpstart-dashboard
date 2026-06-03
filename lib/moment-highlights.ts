import { getPostEngagements, getPostVisibility } from "./metrics";
import type { DashboardMetric } from "./types/dashboard";

type HighlightPostInput = {
  id?: string;
  platform?: string | null;
  media_type?: string | null;
  caption?: string | null;
  posted_at?: string | null;
  url?: string | null;
  metrics?: Record<string, unknown> | null;
};

export type MomentHighlight = {
  date: string;
  label: string;
  metric: "Visibilité" | "Engagements";
  value: number;
  lift: number;
  summary: string;
  topPost?: {
    caption: string;
    platform?: string;
    url?: string | null;
  };
};

function formatDateLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function formatMetric(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(Math.round(value));
}

function truncate(text: string, max = 78): string {
  return text.length > max ? `${text.slice(0, max - 3).trim()}...` : text;
}

function dateKeyFromPost(postedAt?: string | null): string | null {
  if (!postedAt) return null;
  const date = new Date(postedAt);
  if (Number.isNaN(date.getTime())) return postedAt.slice(0, 10) || null;
  return date.toISOString().slice(0, 10);
}

export function buildMomentHighlights({
  metrics,
  posts,
}: {
  metrics: DashboardMetric[];
  posts: HighlightPostInput[];
}): MomentHighlight[] {
  const byDate = new Map<string, { visibility: number; engagements: number }>();

  for (const row of metrics) {
    if (!row.date) continue;
    const existing = byDate.get(row.date) ?? { visibility: 0, engagements: 0 };
    existing.visibility += row.views && row.views > 0 ? row.views : row.reach ?? 0;
    existing.engagements += row.engagements ?? 0;
    byDate.set(row.date, existing);
  }

  const days = Array.from(byDate.entries()).filter(([, item]) => item.visibility > 0 || item.engagements > 0);
  if (days.length < 3) return [];

  const avgVisibility = days.reduce((sum, [, item]) => sum + item.visibility, 0) / days.length;
  const avgEngagements = days.reduce((sum, [, item]) => sum + item.engagements, 0) / days.length;

  const postsByDate = new Map<string, HighlightPostInput[]>();
  for (const post of posts) {
    const dateKey = dateKeyFromPost(post.posted_at);
    if (!dateKey) continue;
    const list = postsByDate.get(dateKey) ?? [];
    list.push(post);
    postsByDate.set(dateKey, list);
  }

  return days
    .map(([date, item]) => {
      const visibilityLift = avgVisibility > 0 ? item.visibility / avgVisibility : 0;
      const engagementLift = avgEngagements > 0 ? item.engagements / avgEngagements : 0;
      const metric: MomentHighlight["metric"] =
        engagementLift >= visibilityLift && item.engagements > 0 ? "Engagements" : "Visibilité";
      const value = metric === "Engagements" ? item.engagements : item.visibility;
      const lift = metric === "Engagements" ? engagementLift : visibilityLift;
      const dayPosts = postsByDate.get(date) ?? [];
      const topPost = dayPosts
        .map((post) => ({
          post,
          score: getPostVisibility(post.metrics, post.media_type).value + getPostEngagements(post.metrics) * 4,
        }))
        .sort((a, b) => b.score - a.score)[0]?.post;
      const postCaption = topPost?.caption ? truncate(topPost.caption, 64) : null;
      const safeTopPost = topPost
        ? {
            caption: postCaption ?? "Publication sans titre",
            platform: topPost.platform ?? undefined,
            url: topPost.url,
          }
        : undefined;

      return {
        date,
        label: formatDateLabel(date),
        metric,
        value,
        lift,
        summary: postCaption
          ? `${metric} au-dessus du rythme habituel, porté par "${postCaption}".`
          : `${metric} au-dessus du rythme habituel sur la journée.`,
        topPost: safeTopPost,
      };
    })
    .filter((item) => item.lift >= 1.35 && item.value > 0)
    .sort((a, b) => b.lift - a.lift)
    .slice(0, 3)
    .map((item) => ({
      ...item,
      summary: `${item.summary} (${formatMetric(item.value)}, x${item.lift.toFixed(1)} vs moyenne).`,
    }));
}
