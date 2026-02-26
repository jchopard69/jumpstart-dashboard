"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ContentDnaResult, ContentPattern } from "@/lib/content-dna";

type ContentDnaCardProps = {
  dna: ContentDnaResult;
};

const iconMap: Record<ContentPattern["icon"], React.ReactNode> = {
  format: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125-.504-1.125-1.125v-1.5c0-.621.504-1.125 1.125-1.125m1.5 2.625c0-.621-.504-1.125-1.125-1.125M12 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m0-3.75c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m0 0v3" />
    </svg>
  ),
  clock: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  caption: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  ),
};

const strengthColors = [
  { min: 70, bg: "bg-emerald-500/15", text: "text-emerald-700", bar: "from-emerald-500 to-emerald-400" },
  { min: 50, bg: "bg-blue-500/15", text: "text-blue-700", bar: "from-blue-500 to-blue-400" },
  { min: 0, bg: "bg-slate-500/10", text: "text-slate-600", bar: "from-slate-400 to-slate-300" },
];

function getStrengthStyle(strength: number) {
  return strengthColors.find(s => strength >= s.min) ?? strengthColors[strengthColors.length - 1];
}

export function ContentDnaCard({ dna }: ContentDnaCardProps) {
  const [open, setOpen] = useState(false);

  if (dna.patterns.length === 0) return null;

  return (
    <Card className="card-surface p-6 fade-in-up">
      <div className="flex items-center gap-2 mb-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10">
          <svg className="h-4.5 w-4.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
          </svg>
        </div>
        <div>
          <h2 className="section-title">Content DNA</h2>
          <p className="text-xs text-muted-foreground">
            Analyse des patterns gagnants sur vos {dna.postsAnalyzed} dernieres publications.
          </p>
        </div>
      </div>

      <div className="mb-4">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg
            className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          Comment c'est calcule ?
        </button>
        {open && (
          <div className="mt-2 text-xs text-muted-foreground leading-relaxed space-y-1.5 ml-5">
            <p>
              L'analyse porte sur 3 dimensions : <span className="font-medium text-foreground/80">format</span> (type de media),{" "}
              <span className="font-medium text-foreground/80">creneau horaire</span> et{" "}
              <span className="font-medium text-foreground/80">longueur de legende</span>.
            </p>
            <p>
              Pour chaque dimension, les engagements moyens par categorie sont compares.
              La barre de confiance represente la surperformance du pattern vs la moyenne.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {dna.patterns.map((pattern) => {
          const style = getStrengthStyle(pattern.strength);
          return (
            <div key={pattern.id} className="rounded-xl border border-border/40 p-4 hover:border-border/60 transition-colors">
              <div className="flex items-start gap-3">
                <div className={cn("shrink-0 mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center", style.bg, style.text)}>
                  {iconMap[pattern.icon]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-foreground">{pattern.insight}</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{pattern.detail}</p>
                  {/* Strength bar */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="h-1 flex-1 rounded-full bg-muted/30 overflow-hidden">
                      <div
                        className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out", style.bar)}
                        style={{ width: `${pattern.strength}%` }}
                      />
                    </div>
                    <span className="text-[10px] tabular-nums text-muted-foreground font-medium">{pattern.strength}%</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
