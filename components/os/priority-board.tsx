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

type PriorityBoardProps = {
  priorities: CollabItem[];
};

export function PriorityBoard({ priorities }: PriorityBoardProps) {
  return (
    <Card className="card-surface p-6 fade-in-up lg:col-span-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            <h2 className="section-title">Objectifs prioritaires</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Focus strategique pour le mois a venir.</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {priorities.length === 0 ? (
          <EmptyState
            title="Aucune priorité définie"
            description="Ajoutez vos priorités pour le mois prochain."
            className="py-8"
          />
        ) : (
          priorities.map((item) => (
            <div
              key={item.id}
              className="group rounded-xl border border-border/60 p-4 transition-all hover:border-purple-200 hover:bg-purple-50/30"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                  )}
                  {item.owner && (
                    <p className="text-xs text-muted-foreground mt-2">
                      <span className="inline-flex items-center gap-1">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                        {item.owner}
                      </span>
                    </p>
                  )}
                </div>
                <Badge className={PRIORITY_STYLES[item.priority] ?? "bg-slate-100 text-slate-600"}>
                  {item.priority}
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
