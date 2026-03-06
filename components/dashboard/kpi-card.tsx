"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: number | null;
  delta: number;
  suffix?: string;
  description?: string;
  className?: string;
  index?: number;
  goal?: number | null;
};

const KPI_DESCRIPTIONS: Record<string, string> = {
  "Abonnés": "Nombre total de followers sur vos comptes connectés.",
  "Vues": "Nombre total de lectures et affichages de vos contenus.",
  "Portée": "Nombre de personnes uniques ayant vu au moins un de vos contenus.",
  "Engagements": "Total des likes, commentaires, partages et sauvegardes.",
  "Publications": "Nombre de posts publiés sur la période sélectionnée.",
  "Taux d'engagement": "Ratio entre les interactions (likes, commentaires, partages, sauvegardes) et les vues sur la période.",
};

function formatDelta(delta: number): string {
  const sign = delta >= 0 ? "+" : "";
  const rounded = Number(delta.toFixed(1));
  // Never abbreviate percentages with K — display the full number
  if (Math.abs(rounded) >= 1000) {
    return `${sign}${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(delta)).replace(/[\u00A0\u202F]/g, "\u2009")}%`;
  }
  if (rounded === Math.round(rounded)) {
    return `${sign}${Math.round(delta)}%`;
  }
  return `${sign}${rounded}%`;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `${m >= 10 ? Math.round(m) : m.toFixed(1).replace(".0", "")}M`;
  }
  if (value >= 100_000) {
    return `${Math.round(value / 1000)}K`;
  }
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })
    .format(value)
    .replace(/[\u00A0\u202F]/g, "\u2009");
}

function AnimatedNumber({ value, suffix }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLParagraphElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) {
      setDisplay(value);
      return;
    }

    // Use IntersectionObserver to only animate when visible
    const el = ref.current;
    if (!el) { setDisplay(value); return; }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setDisplay(value);
      hasAnimated.current = true;
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          hasAnimated.current = true;

          if (value === 0) { setDisplay(0); return; }

          const duration = 600;
          const start = performance.now();
          const from = 0;

          function tick(now: number) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // ease-out-expo
            const eased = 1 - Math.pow(2, -10 * progress);
            setDisplay(Math.round(from + (value - from) * eased));
            if (progress < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  const compact = formatCompact(display);
  const full = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })
    .format(value)
    .replace(/[\u00A0\u202F]/g, "\u2009");
  const isAbbreviated = formatCompact(value) !== full;

  return (
    <div ref={ref}>
      <p className="text-3xl font-semibold font-display tabular-nums animate-count-up">
        {compact}{suffix && <span className="text-xl ml-0.5">{suffix}</span>}
      </p>
      {isAbbreviated && (
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{full}</p>
      )}
    </div>
  );
}

export function KpiCard({ label, value, delta, suffix, description, className, index = 0, goal }: KpiCardProps) {
  const trend = delta >= 0 ? "up" : "down";
  const deltaValue = formatDelta(delta);
  const tooltipText = description || KPI_DESCRIPTIONS[label];

  const goalProgress = goal && goal > 0 && value !== null ? Math.min((value / goal) * 100, 100) : null;

  return (
    <Card
      className={cn("card-surface relative overflow-hidden p-5 fade-in-up group", className)}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Gradient accent bar */}
      <div className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-purple-500 via-violet-500 to-fuchsia-400 opacity-70 transition-opacity group-hover:opacity-100" />

      <div className="flex items-center justify-between gap-2 min-w-0">
        <p className="section-label leading-tight truncate flex items-center gap-1">
          {label}
          {tooltipText && (
            <span
              title={tooltipText}
              className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-muted/60 text-[8px] font-medium text-muted-foreground cursor-help shrink-0"
            >
              ?
            </span>
          )}
        </p>
        {delta !== 0 && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap",
              trend === "up"
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-rose-500/10 text-rose-600"
            )}
          >
            <svg className="h-2.5 w-2.5 shrink-0" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2}>
              {trend === "up" ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 8l4-4 4 4" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 4l4 4 4-4" />
              )}
            </svg>
            {deltaValue}
          </span>
        )}
      </div>

      <div className="mt-4">
        {value === null ? (
          <p className="text-3xl font-semibold font-display text-muted-foreground/50">N/A</p>
        ) : (
          <AnimatedNumber value={value} suffix={suffix} />
        )}
      </div>

      {goalProgress !== null && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>Objectif : {formatCompact(goal!)}{suffix ?? ""}</span>
            <span className="font-medium">{Math.round(goalProgress)}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700",
                goalProgress >= 100 ? "bg-emerald-500" : goalProgress >= 60 ? "bg-violet-500" : "bg-amber-500"
              )}
              style={{ width: `${goalProgress}%` }}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
