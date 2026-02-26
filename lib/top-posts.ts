import { getPostEngagements, getPostVisibility } from "@/lib/metrics";

export function selectDisplayTopPosts<T extends { metrics?: unknown; media_type?: string | null }>(
  posts: T[],
  limit: number
): T[] {
  const postsWithMetrics = posts.filter((post) => {
    return (
      getPostVisibility(post.metrics as any, post.media_type).value > 0 ||
      getPostEngagements(post.metrics as any) > 0
    );
  });
  const displayPosts = postsWithMetrics.length > 0 ? postsWithMetrics : posts;
  return displayPosts.slice(0, limit);
}

