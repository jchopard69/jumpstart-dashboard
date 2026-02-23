"use client";

import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { Card } from "@/components/ui/card";

export type TrendPoint = {
  date: string;
  value: number;
  previousValue?: number;
};

type TrendChartProps = {
  title: string;
  data: TrendPoint[];
  showComparison?: boolean;
  showTrend?: boolean;
};

function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString("fr-FR");
}

function calculateTrend(data: TrendPoint[]): { value: number; direction: "up" | "down" | "neutral" } {
  if (data.length < 2) return { value: 0, direction: "neutral" };

  const first = data[0].value;
  const last = data[data.length - 1].value;

  if (first === 0) return { value: 0, direction: "neutral" };

  const change = ((last - first) / first) * 100;
  return {
    value: Math.abs(change),
    direction: change > 0 ? "up" : change < 0 ? "down" : "neutral"
  };
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  const currentItem = payload.find((item: any) => item.dataKey === "value") ?? payload[0];
  const previousItem = payload.find((item: any) => item.dataKey === "previousValue");
  const current = currentItem?.value ?? 0;
  const previous = previousItem?.value;

  return (
    <div className="rounded-xl border border-border/60 bg-white/98 px-3.5 py-2.5 shadow-lg backdrop-blur-sm">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="text-base font-semibold tabular-nums mt-0.5">{formatNumber(current)}</p>
      {previous !== undefined && (
        <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
          Période préc. : {formatNumber(previous)}
        </p>
      )}
    </div>
  );
}

export function TrendChart({ title, data, showComparison = false, showTrend = true }: TrendChartProps) {
  const gradientId = useId();
  const gradientPrevId = useId();

  const trend = calculateTrend(data);
  const average = data.length > 0
    ? data.reduce((sum, item) => sum + item.value, 0) / data.length
    : 0;

  // Empty state
  if (data.length === 0) {
    return (
      <Card className="card-surface p-5 fade-in-up">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
        </div>
        <div className="h-48 flex items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted/40">
              <svg className="h-5 w-5 text-muted-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <p className="text-xs text-muted-foreground">Aucune donnée disponible</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="card-surface p-5 fade-in-up">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {showTrend && trend.direction !== "neutral" && (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                trend.direction === "up"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-rose-500/10 text-rose-600"
              }`}
            >
              <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2}>
                {trend.direction === "up" ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 8l4-4 4 4" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 4l4 4 4-4" />
                )}
              </svg>
              {trend.value.toFixed(1)}%
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground tabular-nums">
          moy. {formatNumber(Math.round(average))}
        </p>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.7} />
                <stop offset="100%" stopColor="#a855f7" stopOpacity={0.05} />
              </linearGradient>
              {showComparison && (
                <linearGradient id={gradientPrevId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.02} />
                </linearGradient>
              )}
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "hsl(252 12% 44%)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => {
                const parts = value.split("-");
                return parts.length >= 2 ? `${parts[2]}/${parts[1]}` : value;
              }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(252 12% 44%)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatNumber}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={average}
              stroke="#e2e0ec"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            {showComparison && (
              <Area
                type="monotone"
                dataKey="previousValue"
                stroke="#cbd5e1"
                strokeWidth={1}
                fillOpacity={1}
                fill={`url(#${gradientPrevId})`}
                dot={false}
                activeDot={false}
              />
            )}
            <Area
              type="monotone"
              dataKey="value"
              stroke="#7c3aed"
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, fill: "#7c3aed", strokeWidth: 2, stroke: "white" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
