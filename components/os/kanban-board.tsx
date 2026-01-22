"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyPipeline } from "@/components/ui/empty-state";
import type { CollabItem, CollabItemStatus, CollabItemPriority } from "@/lib/types/dashboard";

const STATUS_ORDER: CollabItemStatus[] = ["backlog", "planned", "in_progress", "review", "done"];

const STATUS_LABELS: Record<CollabItemStatus, string> = {
  backlog: "Backlog",
  planned: "Planifié",
  in_progress: "En cours",
  review: "Révision",
  done: "Terminé"
};

const STATUS_COLORS: Record<CollabItemStatus, string> = {
  backlog: "bg-slate-100",
  planned: "bg-blue-50",
  in_progress: "bg-amber-50",
  review: "bg-purple-50",
  done: "bg-emerald-50"
};

const KIND_LABELS: Record<string, string> = {
  idea: "Idée",
  shoot: "Tournage",
  edit: "Montage",
  publish: "Publication",
  next_step: "Action",
  monthly_priority: "Priorité"
};

const PRIORITY_STYLES: Record<CollabItemPriority, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700"
};

type KanbanBoardProps = {
  items: CollabItem[];
  canEdit: boolean;
  updateStatusAction: (formData: FormData) => Promise<void>;
};

export function KanbanBoard({ items, canEdit, updateStatusAction }: KanbanBoardProps) {
  if (items.length === 0) {
    return (
      <div className="card-surface rounded-3xl p-6 fade-in-up">
        <div className="flex items-center gap-2 mb-4">
          <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
          </svg>
          <h2 className="section-title">Pipeline production</h2>
        </div>
        <EmptyPipeline />
      </div>
    );
  }

  return (
    <div className="card-surface rounded-3xl p-6 fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
          </svg>
          <h2 className="section-title">Pipeline production</h2>
        </div>
        <p className="text-sm text-muted-foreground">{items.length} élément{items.length > 1 ? "s" : ""}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {STATUS_ORDER.map((status) => {
          const columnItems = items.filter((item) => item.status === status);
          return (
            <div key={status} className={`rounded-2xl border border-border/60 p-3 ${STATUS_COLORS[status]}`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  {STATUS_LABELS[status]}
                </p>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-semibold shadow-sm">
                  {columnItems.length}
                </span>
              </div>
              <div className="space-y-3 min-h-[100px]">
                {columnItems.map((item) => (
                  <KanbanCard
                    key={item.id}
                    item={item}
                    canEdit={canEdit}
                    currentStatus={status}
                    updateStatusAction={updateStatusAction}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type KanbanCardProps = {
  item: CollabItem;
  canEdit: boolean;
  currentStatus: CollabItemStatus;
  updateStatusAction: (formData: FormData) => Promise<void>;
};

function KanbanCard({ item, canEdit, currentStatus, updateStatusAction }: KanbanCardProps) {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus);
  const canMoveLeft = currentIndex > 0;
  const canMoveRight = currentIndex < STATUS_ORDER.length - 1;

  return (
    <div className="group rounded-xl border border-border/50 bg-white p-3 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-tight">{item.title}</p>
        <Badge className={`shrink-0 ${PRIORITY_STYLES[item.priority] ?? "bg-slate-100 text-slate-600"}`}>
          {item.priority}
        </Badge>
      </div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2">
        {KIND_LABELS[item.kind] ?? item.kind}
      </p>
      {item.due_date && (
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          {new Date(item.due_date).toLocaleDateString("fr-FR")}
        </p>
      )}
      {canEdit && (
        <div className="mt-3 flex gap-1">
          {canMoveLeft && (
            <form action={updateStatusAction} className="flex-1">
              <input type="hidden" name="item_id" value={item.id} />
              <input type="hidden" name="status" value={STATUS_ORDER[currentIndex - 1]} />
              <Button type="submit" variant="ghost" size="sm" className="w-full h-7 text-xs">
                <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                {STATUS_LABELS[STATUS_ORDER[currentIndex - 1]]}
              </Button>
            </form>
          )}
          {canMoveRight && (
            <form action={updateStatusAction} className="flex-1">
              <input type="hidden" name="item_id" value={item.id} />
              <input type="hidden" name="status" value={STATUS_ORDER[currentIndex + 1]} />
              <Button type="submit" variant="ghost" size="sm" className="w-full h-7 text-xs">
                {STATUS_LABELS[STATUS_ORDER[currentIndex + 1]]}
                <svg className="h-3 w-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
