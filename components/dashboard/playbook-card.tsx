"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toaster";
import type { PlaybookAction } from "@/lib/playbook";

type PlaybookCardProps = {
  actions: PlaybookAction[];
  planAction: (taskData: string) => Promise<{ success: boolean; error?: string }>;
};

export function PlaybookCard({ actions, planAction }: PlaybookCardProps) {
  if (actions.length === 0) return null;

  return (
    <Card className="card-surface p-6 fade-in-up overflow-hidden relative">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400" />

      <div className="flex items-center gap-2 mb-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
          <svg className="h-4.5 w-4.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        </div>
        <div>
          <h2 className="section-title">Playbook du mois</h2>
          <p className="text-xs text-muted-foreground">Actions prioritaires basees sur vos donnees.</p>
        </div>
      </div>

      <div className="space-y-3">
        {actions.map((action, index) => (
          <PlaybookActionItem key={action.id} action={action} index={index} planAction={planAction} />
        ))}
      </div>
    </Card>
  );
}

function PlaybookActionItem({
  action,
  index,
  planAction,
}: {
  action: PlaybookAction;
  index: number;
  planAction: PlaybookCardProps["planAction"];
}) {
  const [isPending, startTransition] = useTransition();
  const [isPlanned, setIsPlanned] = useState(false);
  const toaster = useToast();

  const handlePlan = () => {
    startTransition(async () => {
      const result = await planAction(JSON.stringify(action.osTask));
      if (result.success) {
        setIsPlanned(true);
        toaster.success("Ajouté à l'OS", `"${action.osTask.title}" a été planifié.`);
      } else {
        toaster.error("Erreur", result.error ?? "Impossible de créer la tâche.");
      }
    });
  };

  return (
    <div className={cn(
      "rounded-xl border p-4 transition-all",
      action.priority === "high"
        ? "border-amber-200/60 bg-amber-50/40"
        : "border-border/40 bg-muted/10"
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "shrink-0 mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold",
          action.priority === "high"
            ? "bg-amber-100 text-amber-700"
            : "bg-muted/50 text-muted-foreground"
        )}>
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{action.title}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{action.description}</p>
          <p className="text-[11px] text-muted-foreground/70 mt-1.5 italic">{action.rationale}</p>

          <div className="mt-3">
            {isPlanned ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Planifié dans l&apos;OS
              </span>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={handlePlan}
                disabled={isPending}
              >
                {isPending ? (
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                )}
                Planifier dans l&apos;OS
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
