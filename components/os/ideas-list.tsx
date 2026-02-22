import { Card } from "@/components/ui/card";
import { EmptyIdeas } from "@/components/ui/empty-state";
import type { CollabItem } from "@/lib/types/dashboard";

type IdeasListProps = {
  ideas: CollabItem[];
};

export function IdeasList({ ideas }: IdeasListProps) {
  return (
    <Card className="card-surface p-6 fade-in-up">
      <div className="flex items-center gap-2">
        <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
        </svg>
        <h2 className="section-title">Lab creatif</h2>
      </div>
      <div className="mt-4 space-y-3">
        {ideas.length === 0 ? (
          <EmptyIdeas />
        ) : (
          ideas.map((item) => (
            <div
              key={item.id}
              className="group rounded-xl border border-border/60 p-4 transition-all hover:border-purple-200 hover:bg-purple-50/30"
            >
              <p className="text-sm font-medium">{item.title}</p>
              {item.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
              )}
              {item.created_at && (
                <p className="text-[10px] text-muted-foreground/60 mt-2">
                  Ajouté le {new Date(item.created_at).toLocaleDateString("fr-FR")}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
