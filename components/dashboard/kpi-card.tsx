"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: number | null;
  delta: number | null;
  suffix?: string;
  description?: string;
  className?: string;
  index?: number;
  goal?: number | null;
  sparkline?: number[];
};

const KPI_DESCRIPTIONS: Record<string, string> = {
  "Abonnés": "Nombre total de followers sur vos comptes connectés.",
  "Vues": "Nombre total de lectures et affichages de vos contenus.",
  "Portée": "Somme des portées collectées par jour et par compte. Une personne peut être comptée plusieurs fois.",
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

function MetricNumber({ value, suffix, label }: { value: number; suffix?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const full = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: suffix ? 2 : 0 }).format(value);
  const compact = suffix ? (value > 0 && value < 0.1 ? "< 0,1" : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)) : formatCompact(value);
  const isAbbreviated = !suffix && value >= 100000;
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${full}${suffix ?? ""}${label ? ` ${label}` : ""}`);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1200);
    } catch { /* Copy remains optional; the full value is always visible. */ }
  };
  return <button type="button" onClick={handleCopy} title="Copier la valeur" aria-label={`Copier ${full}${suffix ?? ""} ${label ?? ""}`} className="text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
    <span className="block text-3xl font-semibold tracking-tight tabular-nums">{compact}<span className="ml-0.5 text-lg">{suffix}</span></span>
    {isAbbreviated && <span className="mt-1 block text-xs tabular-nums text-muted-foreground">{full}</span>}
    {copied && <span role="status" className="block text-xs text-primary">Copié !</span>}
  </button>;
}

function MiniSparkline({ data, trend }: { data: number[]; trend: "up" | "down" }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const padding = 1;
  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (w - padding * 2);
    const y = h - padding - ((v - min) / range) * (h - padding * 2);
    return `${x},${y}`;
  });
  const color = trend === "up" ? "#10b981" : "#f43f5e";

  return (
    <svg width={w} height={h} className="opacity-65 transition-opacity group-hover:opacity-100" aria-hidden="true">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KpiCard({ label, value, delta, suffix, description, className, index = 0, goal, sparkline }: KpiCardProps) {
  const trend = (delta ?? 0) >= 0 ? "up" : "down";
  const deltaValue = delta == null ? null : formatDelta(delta);
  const tooltipText = description || KPI_DESCRIPTIONS[label];

  const goalProgress = goal && goal > 0 && value !== null ? (value / goal) * 100 : null;

  return (
    <Card
      className={cn(
        "card-surface relative overflow-hidden p-5 fade-in-up group",
        "bg-white",
        className
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className="text-xs font-medium leading-snug text-muted-foreground flex items-center gap-1">
          {label}
          {tooltipText && (
            <span
              title={tooltipText}
              className="inline-flex h-3.5 w-3.5 shrink-0 cursor-help items-center justify-center rounded-full border border-border/60 bg-white text-[8px] font-medium text-muted-foreground"
            >
              ?
            </span>
          )}
        </p>
        {delta != null && delta !== 0 && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold whitespace-nowrap shadow-sm",
              trend === "up"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            )}
          >
            <svg className="h-2.5 w-2.5 shrink-0" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2} aria-hidden="true">
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

      <div className="mt-5">
        {value === null ? (
          <p className="text-3xl font-semibold font-display text-muted-foreground/50">N/A</p>
        ) : (
          <MetricNumber value={value} suffix={suffix} label={label} />
        )}
      </div>

      {delta == null && <p className="mt-2 text-xs text-muted-foreground">Comparaison indisponible</p>}
      {sparkline && sparkline.length >= 2 && (
        <div className="mt-3 rounded-xl border border-border/50 bg-white/50 px-2 py-1">
          <MiniSparkline data={sparkline} trend={trend} />
        </div>
      )}

      {goalProgress !== null && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>Objectif : {formatCompact(goal!)}{suffix ?? ""}</span>
            <span className="font-medium">{Math.round(goalProgress)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted/40 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700",
                goalProgress >= 100
                  ? "bg-[linear-gradient(90deg,#10b981,#20d6a2)]"
                  : goalProgress >= 60
                    ? "bg-[linear-gradient(90deg,#6d4dff,#8b5cf6)]"
                    : "bg-[linear-gradient(90deg,#f59e0b,#fbbf24)]"
              )}
              style={{ width: `${Math.min(goalProgress, 100)}%` }}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
