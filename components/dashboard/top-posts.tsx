"use client";

import { Card } from "@/components/ui/card";
import { EmptyPosts } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_ICONS, PLATFORM_LABELS, type Platform } from "@/lib/types";
import { getPostEngagements, getPostVisibility } from "@/lib/metrics";
import type { PostData } from "@/lib/types/dashboard";

type TopPostsProps = {
  posts: PostData[];
};

function PostThumbnail({ url, platform }: { url?: string; platform?: string }) {
  if (!url) {
    return (
      <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center text-2xl text-muted-foreground">
        {platform ? PLATFORM_ICONS[platform as Platform] ?? "📄" : "📄"}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt="thumbnail"
      className="h-20 w-20 rounded-lg object-cover"
      onError={(e) => {
        // Replace broken image with platform icon placeholder
        const target = e.currentTarget;
        target.style.display = 'none';
        const placeholder = document.createElement('div');
        placeholder.className = 'h-20 w-20 rounded-lg bg-muted flex items-center justify-center text-2xl text-muted-foreground';
        placeholder.textContent = platform ? PLATFORM_ICONS[platform as Platform] ?? "📄" : "📄";
        target.parentNode?.insertBefore(placeholder, target);
      }}
    />
  );
}

export function TopPosts({ posts }: TopPostsProps) {
  const filteredPosts = posts.filter((post) => {
    return getPostVisibility(post.metrics).value > 0 || getPostEngagements(post.metrics) > 0;
  });
  const displayPosts = filteredPosts.length ? filteredPosts : posts;

  return (
    <Card className="card-surface p-6 lg:col-span-2 fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Top contenus</h2>
          <p className="text-sm text-muted-foreground">Publications les plus performantes sur la période.</p>
        </div>
      </div>
      <div className="mt-4 space-y-4">
        {posts.length === 0 ? (
          <EmptyPosts />
        ) : (
          displayPosts.map((post) => {
            const visibility = getPostVisibility(post.metrics);
            const engagements = getPostEngagements(post.metrics);
            return (
              <div key={post.id} className="flex items-start gap-4 border-b border-border pb-4 last:border-0">
                <PostThumbnail url={post.thumbnail_url ?? undefined} platform={post.platform ?? undefined} />
                <div className="flex-1">
                  <p className="text-sm font-medium line-clamp-2">{post.caption ?? "Publication sans titre"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{post.posted_at ? new Date(post.posted_at).toLocaleDateString("fr-FR") : "-"}</span>
                    {post.platform && (
                      <Badge variant="secondary" className="text-[10px]">
                        {PLATFORM_ICONS[post.platform as Platform]} {PLATFORM_LABELS[post.platform as Platform]}
                      </Badge>
                    )}
                    {post.url && (
                      <a className="text-purple-600 hover:underline" href={post.url} target="_blank" rel="noreferrer">
                        Voir
                      </a>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>
                    Visibilite: {visibility.value > 0 ? visibility.value.toLocaleString() : "-"} ({visibility.label})
                  </p>
                  <p>
                    Engagements: {engagements > 0 ? engagements.toLocaleString() : "-"}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
