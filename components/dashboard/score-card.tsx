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

const scoreColors: Record<string, string> = {
  "A+": "from-emerald-500 to-emerald-400",
  "A": "from-emerald-500 to-emerald-400",
  "B+": "from-blue-500 to-blue-400",
  "B": "from-blue-500 to-blue-400",
  "C+": "from-amber-500 to-amber-400",
  "C": "from-amber-500 to-amber-400",
  "D": "from-rose-500 to-rose-400",
};

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg className="h-36 w-36 -rotate-90" viewBox="0 0 120 120">
        {/* Background ring */}
        <circle
          cx="60" cy="60" r="54"
          fill="none"
          stroke="currentColor"
          className="text-muted/30"
          strokeWidth="8"
        />
        {/* Score ring */}
        <circle
          cx="60" cy="60" r="54"
          fill="none"
          stroke="url(#scoreGradient)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
        <defs>
          <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(139, 92, 246)" />
            <stop offset="100%" stopColor="rgb(168, 85, 247)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold font-display">{score}</span>
        <span className={cn("text-sm font-semibold", gradeColors[grade] ?? "text-muted-foreground")}>
          {grade}
        </span>
      </div>
    </div>
  );
}

function SubScoreBar({ label, value, description }: { label: string; value: number; description: string }) {
  return (
    <div className="space-y-1" title={description}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{Math.round(value)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
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
    <Card className="card-surface p-6 lg:col-span-3 fade-in-up overflow-hidden relative">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-500 via-violet-500 to-fuchsia-400" />

      <div className="flex items-center gap-2 mb-5">
        <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
        <h2 className="section-title">Synthese executive</h2>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Score ring */}
        <div className="flex flex-col items-center gap-3">
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">JumpStart Score</p>
          <ScoreRing score={score.global} grade={score.grade} />
        </div>

        {/* Sub-scores */}
        <div className="flex-1 space-y-3 min-w-0">
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
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">A retenir</p>
            <ul className="space-y-2">
              {takeaways.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {executiveSummary}
          </p>
        </div>
      </div>
    </Card>
  );
}
