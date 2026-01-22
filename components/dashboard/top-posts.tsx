import { Card } from "@/components/ui/card";
import { EmptyPosts } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_ICONS, PLATFORM_LABELS, type Platform } from "@/lib/types";
import type { PostData } from "@/lib/types/dashboard";

type TopPostsProps = {
  posts: PostData[];
};

export function TopPosts({ posts }: TopPostsProps) {
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
          posts.map((post) => (
            <div key={post.id} className="flex items-start gap-4 border-b border-border pb-4 last:border-0">
              {post.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.thumbnail_url} alt="thumbnail" className="h-20 w-20 rounded-lg object-cover" />
              ) : (
                <div className="h-20 w-20 rounded-lg bg-muted" />
              )}
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
                <p>Impressions: {(post.metrics?.impressions ?? post.metrics?.views ?? 0).toLocaleString()}</p>
                <p>Engagements: {(post.metrics?.engagements ?? post.metrics?.likes ?? 0).toLocaleString()}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
