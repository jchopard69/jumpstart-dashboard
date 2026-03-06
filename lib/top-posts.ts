import { getPostEngagements, getPostVisibility } from "@/lib/metrics";
import { computeContentScore } from "@/lib/scoring";

export type TopPostsSortMode = "performance" | "visibility" | "engagement";

export function selectDisplayTopPosts<T extends { metrics?: unknown; media_type?: string | null }>(
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
  const displayPosts = postsWithMetrics.length > 0 ? postsWithMetrics : posts;

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

    if (sortMode === "visibility") {
      return bVis - aVis;
    }

    if (sortMode === "engagement") {
      const aRate = aVis > 0 ? aEng / aVis : 0;
      const bRate = bVis > 0 ? bEng / bVis : 0;
      return bRate - aRate;
    }

    // "performance" — sort by Content Score (engagement-weighted composite)
    const aScore = computeContentScore(
      { impressions: aVis, engagements: aEng, views: aVis },
      cohort
    ).score;
    const bScore = computeContentScore(
      { impressions: bVis, engagements: bEng, views: bVis },
      cohort
    ).score;
    return bScore - aScore;
  });

  return sorted.slice(0, limit);
}
