import { getPostEngagements, getPostVisibility } from "./metrics";

export type TopPostsSortMode = "performance" | "visibility" | "engagement";

function getPostTime(post: { posted_at?: string | null; created_at?: string | null }): number {
  const timestamp = post.posted_at ?? post.created_at;
  if (!timestamp) return 0;
  const time = new Date(timestamp).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function selectDisplayTopPosts<T extends { metrics?: unknown; media_type?: string | null; posted_at?: string | null; created_at?: string | null }>(
  posts: T[],
  limit: number,
  sortMode: TopPostsSortMode = "performance"
): T[] {
  const postsWithMetrics = posts.filter((post) => {
    return (
      getPostVisibility(post.metrics as any, post.media_type).value > 0 ||
      getPostEngagements(post.metrics as any) > 0
    );
  });
  const modeEligiblePosts = postsWithMetrics.filter((post) => {
    const visibility = getPostVisibility(post.metrics as any, post.media_type).value;
    const engagements = getPostEngagements(post.metrics as any);

    if (sortMode === "visibility") return visibility > 0;
    if (sortMode === "engagement") return engagements > 0;
    return visibility > 0 || engagements > 0;
  });
  const displayPosts = modeEligiblePosts.length > 0
    ? modeEligiblePosts
    : postsWithMetrics.length > 0
      ? postsWithMetrics
      : posts;

  // Build cohort stats for content scoring
  const cohortImpressions = displayPosts.map((p) => getPostVisibility(p.metrics as any, p.media_type).value);
  const cohortEngagements = displayPosts.map((p) => getPostEngagements(p.metrics as any));
  const cohort = {
    maxImpressions: Math.max(0, ...cohortImpressions),
    maxEngagements: Math.max(0, ...cohortEngagements),
    maxViews: Math.max(0, ...cohortImpressions),
    avgImpressions: cohortImpressions.length > 0 ? cohortImpressions.reduce((a, b) => a + b, 0) / cohortImpressions.length : 0,
    avgEngagements: cohortEngagements.length > 0 ? cohortEngagements.reduce((a, b) => a + b, 0) / cohortEngagements.length : 0,
  };

  const sorted = [...displayPosts].sort((a, b) => {
    const aVis = getPostVisibility(a.metrics as any, a.media_type).value;
    const bVis = getPostVisibility(b.metrics as any, b.media_type).value;
    const aEng = getPostEngagements(a.metrics as any);
    const bEng = getPostEngagements(b.metrics as any);
    const aRate = aVis > 0 ? aEng / aVis : 0;
    const bRate = bVis > 0 ? bEng / bVis : 0;

    if (sortMode === "visibility") {
      return bVis - aVis || bEng - aEng || bRate - aRate || getPostTime(b) - getPostTime(a);
    }

    if (sortMode === "engagement") {
      return bEng - aEng || bRate - aRate || bVis - aVis || getPostTime(b) - getPostTime(a);
    }

    // Performance intentionally differs from the raw metric tabs:
    // it rewards posts that combine strong visibility and strong engagement,
    // instead of letting one large metric dominate the ranking.
    const aScore = computeBalancedPerformanceRank(aVis, aEng, cohort);
    const bScore = computeBalancedPerformanceRank(bVis, bEng, cohort);
    return bScore - aScore || bEng - aEng || bVis - aVis || bRate - aRate || getPostTime(b) - getPostTime(a);
  });

  return sorted.slice(0, limit);
}

function computeBalancedPerformanceRank(
  visibility: number,
  engagements: number,
  cohort: { maxImpressions: number; maxEngagements: number; avgImpressions: number; avgEngagements: number }
): number {
  const maxVisibility = cohort.maxImpressions || 1;
  const maxEngagements = cohort.maxEngagements || 1;
  const visibilityNorm = visibility > 0 ? visibility / maxVisibility : 0;
  const engagementNorm = engagements > 0 ? engagements / maxEngagements : 0;
  const rate = visibility > 0 ? engagements / visibility : 0;
  const avgRate = cohort.avgImpressions > 0 ? cohort.avgEngagements / cohort.avgImpressions : 0;
  const rateNorm = avgRate > 0 ? Math.min(rate / avgRate, 2) / 2 : 0;

  const balancedImpact = Math.sqrt(visibilityNorm * engagementNorm);
  return balancedImpact * 70 + rateNorm * 30;
}
