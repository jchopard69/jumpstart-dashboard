"use client";

import { useState } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { EmptyPosts } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_ICONS, PLATFORM_LABELS, type Platform } from "@/lib/types";
import { getPostEngagements, getPostVisibility } from "@/lib/metrics";
import { computeContentScore } from "@/lib/scoring";
import { selectDisplayTopPosts, type TopPostsSortMode } from "@/lib/top-posts";
import { cn } from "@/lib/utils";
import type { PostData } from "@/lib/types/dashboard";

type TopPostsProps = {
  posts: PostData[];
};

function PostThumbnail({ url, platform }: { url?: string; platform?: string }) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <div className="h-20 w-20 rounded-xl bg-muted/60 flex items-center justify-center text-xl text-muted-foreground">
        {platform ? PLATFORM_ICONS[platform as Platform] ?? "📄" : "📄"}
      </div>
    );
  }

  return (
    <div className="relative h-20 w-20 overflow-hidden rounded-xl ring-1 ring-border/40">
      <Image
        src={url}
        alt="thumbnail"
        fill
        sizes="80px"
        className="object-cover"
        unoptimized
        onError={() => setFailed(true)}
      />
    </div>
  );
}

const tierRingColors: Record<string, string> = {
  top: "#10b981",
  strong: "#3b82f6",
  average: "#94a3b8",
  weak: "#cbd5e1",
};

function ScoreRing({ score, tier }: { score: number; tier: string }) {
  const color = tierRingColors[tier] ?? tierRingColors.average;
  const radius = 11;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(score, 100) / 100;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="relative flex items-center justify-center" style={{ width: 30, height: 30 }}>
      <svg width={30} height={30} className="absolute inset-0 -rotate-90">
        <circle cx={15} cy={15} r={radius} fill="white" stroke="#e2e8f0" strokeWidth={2.5} />
        <circle
          cx={15}
          cy={15}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </svg>
      <span className="relative text-[10px] font-bold leading-none" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

const tierStyles: Record<string, { bg: string; label: string }> = {
  top: { bg: "bg-emerald-500/10 text-emerald-700 border-emerald-200", label: "Top" },
  strong: { bg: "bg-blue-500/10 text-blue-700 border-blue-200", label: "Fort" },
  average: { bg: "bg-slate-500/10 text-slate-600 border-slate-200", label: "Moyen" },
  weak: { bg: "bg-slate-100 text-slate-500 border-slate-200", label: "Faible" },
};

function formatMetric(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}K`;
  if (value >= 1_000) return `${(value / 1000).toFixed(1).replace(".0", "")}K`;
  return value.toLocaleString("fr-FR");
}

const SORT_MODE_LABELS: Record<TopPostsSortMode, { title: string; subtitle: string }> = {
  performance: { title: "Contenus les plus performants", subtitle: "Les publications ayant généré le plus d'impact sur la période." },
  visibility: { title: "Contenus les plus visibles", subtitle: "Les publications ayant touché le plus de personnes." },
  engagement: { title: "Contenus les plus engageants", subtitle: "Les publications avec le meilleur taux d'interaction." },
};

const INITIAL_COUNT = 5;

export function TopPosts({ posts }: TopPostsProps) {
  const [expanded, setExpanded] = useState(false);
  const [sortMode, setSortMode] = useState<TopPostsSortMode>("performance");

  const displayPosts = selectDisplayTopPosts(posts, posts.length, sortMode);
  const visiblePosts = expanded ? displayPosts : displayPosts.slice(0, INITIAL_COUNT);
  const hasMore = displayPosts.length > INITIAL_COUNT;

  // Compute cohort stats for Content Impact Score
  const cohortImpressions = displayPosts.map((p) => getPostVisibility(p.metrics, p.media_type).value);
  const cohortEngagements = displayPosts.map(p => getPostEngagements(p.metrics));
  const cohort = {
    maxImpressions: Math.max(0, ...cohortImpressions),
    maxEngagements: Math.max(0, ...cohortEngagements),
    maxViews: Math.max(0, ...cohortImpressions),
    avgImpressions: cohortImpressions.length > 0 ? cohortImpressions.reduce((a, b) => a + b, 0) / cohortImpressions.length : 0,
    avgEngagements: cohortEngagements.length > 0 ? cohortEngagements.reduce((a, b) => a + b, 0) / cohortEngagements.length : 0,
  };

  const { title, subtitle } = SORT_MODE_LABELS[sortMode];

  return (
    <Card className="card-surface p-6 fade-in-up">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="section-title">{title}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        {displayPosts.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {displayPosts.length} publication{displayPosts.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Sort mode tabs */}
      <div className="flex gap-1 mb-4">
        {(["performance", "visibility", "engagement"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => { setSortMode(mode); setExpanded(false); }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              sortMode === mode
                ? "bg-purple-100 text-purple-700"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            )}
          >
            {mode === "performance" ? "Performance" : mode === "visibility" ? "Visibilité" : "Engagements"}
          </button>
        ))}
      </div>

      {posts.length === 0 ? (
        <EmptyPosts />
      ) : (
        <div className="space-y-1">
          {visiblePosts.map((post, idx) => {
            const visibility = getPostVisibility(post.metrics, post.media_type);
            const engagements = getPostEngagements(post.metrics);
            const contentScore = computeContentScore(
              { impressions: visibility.value, engagements, views: visibility.value },
              cohort
            );
            const tier = tierStyles[contentScore.tier] ?? tierStyles.average;

            // Compute per-post engagement rate
            const engRate = visibility.value > 0
              ? (engagements / visibility.value) * 100
              : null;
            const engRateLabel = engRate !== null
              ? (engRate < 0.1 && engRate > 0 ? "< 0.1%" : `${engRate.toFixed(1)}%`)
              : (engagements > 0 ? "N/A" : null);

            const rankDisplay = idx < 3
              ? ["🥇", "🥈", "🥉"][idx]
              : String(idx + 1);

            return (
              <a
                key={post.id}
                href={post.url ?? undefined}
                target={post.url ? "_blank" : undefined}
                rel={post.url ? "noreferrer" : undefined}
                className={cn(
                  "group relative flex items-center gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-muted/30",
                  post.url && "cursor-pointer"
                )}
              >
                {/* Rank */}
                <span className="w-5 shrink-0 text-center text-xs font-semibold text-muted-foreground/60 tabular-nums">
                  {rankDisplay}
                </span>

                {/* Thumbnail */}
                <div className="relative shrink-0">
                  <PostThumbnail url={post.thumbnail_url ?? undefined} platform={post.platform ?? undefined} />
                  <div className="absolute -top-2 -right-2">
                    <ScoreRing score={contentScore.score} tier={contentScore.tier} />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1 group-hover:text-foreground transition-colors">
                    {post.caption ?? "Publication sans titre"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      {post.posted_at ? new Date(post.posted_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "-"}
                    </span>
                    {post.platform && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {PLATFORM_ICONS[post.platform as Platform]} {PLATFORM_LABELS[post.platform as Platform]}
                      </Badge>
                    )}
                    <span className={cn(
                      "rounded-full border px-2 py-0.5 text-xs font-medium",
                      tier.bg
                    )}>
                      {tier.label}
                    </span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="shrink-0 text-right space-y-0.5">
                  {visibility.value > 0 ? (
                    <>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatMetric(visibility.value)}
                        <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                          {visibility.label.toLowerCase()}
                        </span>
                      </p>
                      {cohort.avgImpressions > 0 && (() => {
                        const ratio = Math.round(((visibility.value - cohort.avgImpressions) / cohort.avgImpressions) * 100);
                        if (Math.abs(ratio) < 5) return null;
                        return (
                          <p className={cn("text-[10px] tabular-nums font-medium", ratio > 0 ? "text-emerald-600" : "text-rose-500")}>
                            {ratio > 0 ? "+" : ""}{ratio}% vs moy.
                          </p>
                        );
                      })()}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">-</p>
                  )}
                  {engagements > 0 ? (
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {formatMetric(engagements)} eng.
                      {engRateLabel && (
                        <span className="ml-1 text-[10px] text-muted-foreground/70">({engRateLabel})</span>
                      )}
                    </p>
                  ) : null}
                </div>

                {/* External link indicator */}
                {post.url && (
                  <span className="shrink-0 rounded-lg p-1.5 text-muted-foreground/40 opacity-0 transition-all group-hover:opacity-100">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </span>
                )}
              </a>
            );
          })}
        </div>
      )}

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 w-full rounded-xl border border-border/60 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
        >
          {expanded ? "Voir moins" : `Voir les ${displayPosts.length - INITIAL_COUNT} autres publications`}
        </button>
      )}
    </Card>
  );
}
