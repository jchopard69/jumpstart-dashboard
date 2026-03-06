"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { JumpStartScore } from "@/lib/scoring";

type ScoreCardProps = {
  score: JumpStartScore;
  takeaways: string[];
  executiveSummary: string;
  dataCoverage?: number | null; // 0-100
  postsAnalyzed?: number;
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

const glowGrades = new Set(["A+", "A", "B+"]);

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  const colors = ringColors[grade] ?? { from: "rgb(139, 92, 246)", to: "rgb(168, 85, 247)" };
  const hasGlow = glowGrades.has(grade);

  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
        {hasGlow && (
          <defs>
            <filter id="scoreGlow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        )}
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
          filter={hasGlow ? "url(#scoreGlow)" : undefined}
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

function getSubScoreColor(value: number): string {
  if (value >= 70) return "from-emerald-500 to-emerald-400";
  if (value >= 50) return "from-blue-500 to-blue-400";
  if (value >= 30) return "from-amber-500 to-amber-400";
  return "from-rose-400 to-rose-300";
}

function getSubScoreTextColor(value: number): string {
  if (value >= 70) return "text-emerald-600";
  if (value >= 50) return "text-blue-600";
  if (value >= 30) return "text-amber-600";
  return "text-rose-500";
}

function SubScoreBar({ label, value, description }: { label: string; value: number; description: string }) {
  const barColor = getSubScoreColor(value);
  const textColor = getSubScoreTextColor(value);

  return (
    <div className="group space-y-1.5" title={description}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
        <span className={cn("font-semibold tabular-nums", textColor)}>{Math.round(value)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
        <div
          className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-1000 ease-out", barColor)}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function ScoreMethodology({ subScores }: { subScores: JumpStartScore["subScores"] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-border/40 mt-6 pt-4">
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
        Comment est calculé ce score ?
      </button>
      {open && (
        <div className="mt-3 space-y-3 text-xs text-muted-foreground leading-relaxed">
          <p>
            Le JumpStart Score est un indice composite (0-100) mesurant votre performance digitale
            sur la période sélectionnée. Il est calculé à partir de 5 composantes :
          </p>
          <ul className="space-y-1.5 ml-1">
            {subScores.map((sub) => (
              <li key={sub.key} className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-purple-400" />
                <span>
                  <span className="font-medium text-foreground/80">{sub.label}</span>{" "}
                  ({Math.round(sub.weight * 100)}%) — {sub.description}
                </span>
              </li>
            ))}
          </ul>
          <p>
            Chaque composante est normalisée sur 100 selon des benchmarks sectoriels
            (ex : taux d'engagement de 3% = 70/100). Le score global est la moyenne
            pondérée des 5 composantes. La note (A+ à D) facilite la lecture rapide.
          </p>
        </div>
      )}
    </div>
  );
}

export function ScoreCard({ score, takeaways, executiveSummary, dataCoverage, postsAnalyzed }: ScoreCardProps) {
  const confidenceLabel = dataCoverage != null
    ? dataCoverage >= 80 ? "Fiabilité élevée" : dataCoverage >= 50 ? "Fiabilité moyenne" : "Fiabilité limitée"
    : null;
  const confidenceColor = dataCoverage != null
    ? dataCoverage >= 80 ? "text-emerald-600 bg-emerald-50" : dataCoverage >= 50 ? "text-amber-600 bg-amber-50" : "text-rose-600 bg-rose-50"
    : null;
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
          <h2 className="section-title">Synthèse exécutive</h2>
          <p className="text-xs text-muted-foreground">Vue d'ensemble de votre performance digitale.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Score ring */}
        <div className="flex flex-col items-center gap-2">
          <p className="section-label">JumpStart Score</p>
          <ScoreRing score={score.global} grade={score.grade} />
          {confidenceLabel && confidenceColor && (
            <span className={cn("text-[10px] font-medium rounded-full px-2 py-0.5", confidenceColor)}>
              {confidenceLabel}{dataCoverage != null ? ` (${dataCoverage}%)` : ""}
            </span>
          )}
          {postsAnalyzed != null && postsAnalyzed > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {postsAnalyzed} publication{postsAnalyzed > 1 ? "s" : ""} analysée{postsAnalyzed > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Sub-scores */}
        <div className="flex-1 space-y-3 min-w-0">
          <p className="section-label mb-3">Composantes</p>
          {score.subScores.map((sub) => (
            <SubScoreBar
              key={sub.key}
              label={sub.label}
              value={sub.value}
              description={sub.description}
            />
          ))}
        </div>

        {/* Takeaways + Methodology */}
        <div className="flex-1 min-w-0 space-y-4">
          <div>
            <p className="section-label mb-3">À retenir</p>
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

      <ScoreMethodology subScores={score.subScores} />
    </Card>
  );
}
