import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { CollabItem, CollabItemPriority } from "@/lib/types/dashboard";

const PRIORITY_STYLES: Record<CollabItemPriority, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700"
};

type NextStepsTrackerProps = {
  nextSteps: CollabItem[];
};

export function NextStepsTracker({ nextSteps }: NextStepsTrackerProps) {
  return (
    <Card className="card-surface p-6 fade-in-up">
      <div className="flex items-center gap-2">
        <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="section-title">Next steps</h2>
      </div>
      <div className="mt-4 space-y-3">
        {nextSteps.length === 0 ? (
          <EmptyState
            title="Aucun next step"
            description="Ajoutez vos prochaines actions ici."
            className="py-6"
          />
        ) : (
          nextSteps.map((item) => (
            <div
              key={item.id}
              className="group rounded-xl border border-border/60 p-4 transition-all hover:border-purple-200 hover:bg-purple-50/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.owner && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="inline-flex items-center gap-1">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                        {item.owner}
                      </span>
                    </p>
                  )}
                  {item.due_date && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="inline-flex items-center gap-1">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                        {new Date(item.due_date).toLocaleDateString("fr-FR")}
                      </span>
                    </p>
                  )}
                </div>
                <Badge className={PRIORITY_STYLES[item.priority] ?? "bg-slate-100 text-slate-600"}>
                  {item.priority}
                </Badge>
              </div>
              {item.description && (
                <p className="text-xs text-muted-foreground mt-2">{item.description}</p>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
