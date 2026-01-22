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
    <div className="rounded-xl border border-border/60 bg-white/95 px-3 py-2 shadow-soft backdrop-blur">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{formatNumber(current)}</p>
      {previous !== undefined && (
        <p className="text-xs text-muted-foreground">
          Période précédente: {formatNumber(previous)}
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

  return (
    <Card className="card-surface p-4 fade-in-up">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {showTrend && trend.direction !== "neutral" && (
            <span
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                trend.direction === "up"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-rose-500/10 text-rose-600"
              }`}
            >
              {trend.direction === "up" ? (
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              ) : (
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              )}
              {trend.value.toFixed(1)}%
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Moy: {formatNumber(Math.round(average))}
        </p>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.85} />
                <stop offset="100%" stopColor="#a855f7" stopOpacity={0.08} />
              </linearGradient>
              {showComparison && (
                <linearGradient id={gradientPrevId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.05} />
                </linearGradient>
              )}
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => {
                const parts = value.split("-");
                return parts.length >= 2 ? `${parts[2]}/${parts[1]}` : value;
              }}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatNumber}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={average}
              stroke="#d1d5db"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
            {showComparison && (
              <Area
                type="monotone"
                dataKey="previousValue"
                stroke="#94a3b8"
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
              activeDot={{ r: 4, fill: "#7c3aed", strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
