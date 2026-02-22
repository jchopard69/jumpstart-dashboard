"use client";

import { Card } from "@/components/ui/card";
import { EmptyPosts } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_ICONS, PLATFORM_LABELS, type Platform } from "@/lib/types";
import { getPostEngagements, getPostVisibility, getPostImpressions } from "@/lib/metrics";
import { computeContentScore } from "@/lib/scoring";
import { cn } from "@/lib/utils";
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

const tierColors: Record<string, string> = {
  top: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  strong: "bg-blue-500/10 text-blue-700 border-blue-200",
  average: "bg-slate-500/10 text-slate-600 border-slate-200",
  weak: "bg-slate-100 text-slate-500 border-slate-200",
};

const tierLabels: Record<string, string> = {
  top: "Top", strong: "Fort", average: "Moyen", weak: "Faible",
};

export function TopPosts({ posts }: TopPostsProps) {
  const filteredPosts = posts.filter((post) => {
    return getPostVisibility(post.metrics).value > 0 || getPostEngagements(post.metrics) > 0;
  });
  const displayPosts = filteredPosts.length ? filteredPosts : posts;

  // Compute cohort stats for Content Impact Score
  const cohortImpressions = displayPosts.map(p => getPostImpressions(p.metrics));
  const cohortEngagements = displayPosts.map(p => getPostEngagements(p.metrics));
  const cohort = {
    maxImpressions: Math.max(0, ...cohortImpressions),
    maxEngagements: Math.max(0, ...cohortEngagements),
    maxViews: Math.max(0, ...cohortImpressions),
    avgImpressions: cohortImpressions.length > 0 ? cohortImpressions.reduce((a, b) => a + b, 0) / cohortImpressions.length : 0,
    avgEngagements: cohortEngagements.length > 0 ? cohortEngagements.reduce((a, b) => a + b, 0) / cohortEngagements.length : 0,
  };

  return (
    <Card className="card-surface p-6 lg:col-span-2 fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Contenus phares</h2>
          <p className="text-sm text-muted-foreground">Les publications a plus fort impact sur la periode.</p>
        </div>
      </div>
      <div className="mt-4 space-y-4">
        {posts.length === 0 ? (
          <EmptyPosts />
        ) : (
          displayPosts.map((post) => {
            const visibility = getPostVisibility(post.metrics);
            const engagements = getPostEngagements(post.metrics);
            const impressions = getPostImpressions(post.metrics);
            const contentScore = computeContentScore(
              { impressions, engagements, views: impressions },
              cohort
            );
            return (
              <div key={post.id} className="flex items-start gap-4 border-b border-border pb-4 last:border-0">
                <div className="relative">
                  <PostThumbnail url={post.thumbnail_url ?? undefined} platform={post.platform ?? undefined} />
                  <span className={cn(
                    "absolute -top-1.5 -right-1.5 rounded-full border px-1.5 py-0.5 text-[9px] font-bold",
                    tierColors[contentScore.tier]
                  )}>
                    {contentScore.score}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium line-clamp-2">{post.caption ?? "Publication sans titre"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{post.posted_at ? new Date(post.posted_at).toLocaleDateString("fr-FR") : "-"}</span>
                    {post.platform && (
                      <Badge variant="secondary" className="text-[10px]">
                        {PLATFORM_ICONS[post.platform as Platform]} {PLATFORM_LABELS[post.platform as Platform]}
                      </Badge>
                    )}
                    <span className={cn(
                      "rounded-full border px-1.5 py-0.5 text-[9px] font-medium",
                      tierColors[contentScore.tier]
                    )}>
                      Impact {tierLabels[contentScore.tier]}
                    </span>
                    {post.url && (
                      <a className="text-purple-600 hover:underline" href={post.url} target="_blank" rel="noreferrer">
                        Voir
                      </a>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs space-y-1">
                  {visibility.value > 0 ? (
                    <p className="text-foreground font-medium">
                      {visibility.value.toLocaleString("fr-FR")} <span className="text-muted-foreground font-normal">{visibility.label.toLowerCase()}</span>
                    </p>
                  ) : (
                    <p className="text-muted-foreground">-</p>
                  )}
                  {engagements > 0 ? (
                    <p className="text-foreground font-medium">
                      {engagements.toLocaleString("fr-FR")} <span className="text-muted-foreground font-normal">engagements</span>
                    </p>
                  ) : (
                    <p className="text-muted-foreground">-</p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
