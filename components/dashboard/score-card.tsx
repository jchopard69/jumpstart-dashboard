"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { JumpStartScore } from "@/lib/scoring";

type ScoreCardProps = {
  score: JumpStartScore;
  takeaways: string[];
  executiveSummary: string;
};

const gradeColors: Record<string, string> = {
  "A+": "text-emerald-600",
  "A": "text-emerald-600",
  "B+": "text-blue-600",
  "B": "text-blue-600",
  "C+": "text-amber-600",
  "C": "text-amber-600",
  "D": "text-rose-600",
};

const ringColors: Record<string, { from: string; to: string }> = {
  "A+": { from: "rgb(16, 185, 129)", to: "rgb(52, 211, 153)" },
  "A": { from: "rgb(16, 185, 129)", to: "rgb(52, 211, 153)" },
  "B+": { from: "rgb(59, 130, 246)", to: "rgb(96, 165, 250)" },
  "B": { from: "rgb(59, 130, 246)", to: "rgb(96, 165, 250)" },
  "C+": { from: "rgb(245, 158, 11)", to: "rgb(251, 191, 36)" },
  "C": { from: "rgb(245, 158, 11)", to: "rgb(251, 191, 36)" },
  "D": { from: "rgb(244, 63, 94)", to: "rgb(251, 113, 133)" },
};

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  const colors = ringColors[grade] ?? { from: "rgb(139, 92, 246)", to: "rgb(168, 85, 247)" };

  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
        <circle
          cx="60" cy="60" r="54"
          fill="none"
          stroke="currentColor"
          className="text-muted/20"
          strokeWidth="7"
        />
        <circle
          cx="60" cy="60" r="54"
          fill="none"
          stroke="url(#scoreGrad)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={colors.from} />
            <stop offset="100%" stopColor={colors.to} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold font-display tabular-nums">{score}</span>
        <span className={cn("text-sm font-semibold", gradeColors[grade] ?? "text-muted-foreground")}>
          {grade}
        </span>
      </div>
    </div>
  );
}

function SubScoreBar({ label, value, description }: { label: string; value: number; description: string }) {
  return (
    <div className="group space-y-1.5" title={description}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
        <span className="font-semibold tabular-nums">{Math.round(value)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-400 transition-all duration-1000 ease-out"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function ScoreCard({ score, takeaways, executiveSummary }: ScoreCardProps) {
  return (
    <Card className="card-surface p-6 fade-in-up overflow-hidden relative">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-purple-500 via-violet-500 to-fuchsia-400" />

      <div className="flex items-center gap-2 mb-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
          <svg className="h-4.5 w-4.5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
        </div>
        <div>
          <h2 className="section-title">Synthese executive</h2>
          <p className="text-xs text-muted-foreground">Vue d'ensemble de votre performance digitale.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Score ring */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-medium">JumpStart Score</p>
          <ScoreRing score={score.global} grade={score.grade} />
        </div>

        {/* Sub-scores */}
        <div className="flex-1 space-y-3 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium mb-3">Composantes</p>
          {score.subScores.map((sub) => (
            <SubScoreBar
              key={sub.key}
              label={sub.label}
              value={sub.value}
              description={sub.description}
            />
          ))}
        </div>

        {/* Takeaways */}
        <div className="flex-1 min-w-0 space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium mb-3">A retenir</p>
            <ul className="space-y-2.5">
              {takeaways.map((t, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          {executiveSummary && (
            <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/40 pt-3">
              {executiveSummary}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
