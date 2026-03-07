"use client";

import { useId } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";
import { Card } from "@/components/ui/card";

type DailyPoint = {
  date: string;
  spend: number;
  impressions: number;
};

type AdsChartProps = {
  data: DailyPoint[];
};

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0
});

function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  const spendItem = payload.find((item: any) => item.dataKey === "spend");
  const impressionsItem = payload.find((item: any) => item.dataKey === "impressions");

  return (
    <div className="rounded-xl border border-border/60 bg-white/98 px-3.5 py-2.5 shadow-lg backdrop-blur-sm">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {spendItem && (
        <p className="text-sm font-semibold tabular-nums mt-1">
          <span className="inline-block h-2 w-2 rounded-full bg-purple-500 mr-1.5" />
          {currencyFormatter.format(spendItem.value)}
        </p>
      )}
      {impressionsItem && (
        <p className="text-sm font-semibold tabular-nums mt-0.5">
          <span className="inline-block h-2 w-2 rounded-full bg-violet-400 mr-1.5" />
          {new Intl.NumberFormat("fr-FR").format(impressionsItem.value)} impressions
        </p>
      )}
    </div>
  );
}

export function AdsChart({ data }: AdsChartProps) {
  const gradientId = useId();

  if (data.length === 0) {
    return (
      <Card className="card-surface p-5 fade-in-up">
        <div className="mb-2">
          <p className="text-sm font-medium text-foreground">Dépenses & Impressions</p>
        </div>
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted/40">
              <svg
                className="h-5 w-5 text-muted-foreground/60"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                />
              </svg>
            </div>
            <p className="text-xs text-muted-foreground">Aucune donnée disponible</p>
          </div>
        </div>
      </Card>
    );
  }

  // If only 1 data point, duplicate so recharts can draw
  const chartData =
    data.length === 1 ? [data[0], { ...data[0], date: data[0].date + " " }] : data;

  return (
    <Card className="card-surface p-5 fade-in-up">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Dépenses & Impressions</p>
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-purple-500" />
            Dépenses
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-violet-400" />
            Impressions
          </span>
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#a855f7" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(252 12% 90%)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "hsl(252 12% 44%)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => {
                const parts = value.split("-");
                return parts.length >= 3 ? `${parts[2]}/${parts[1]}` : value;
              }}
            />
            <YAxis
              yAxisId="spend"
              orientation="left"
              tick={{ fontSize: 10, fill: "hsl(252 12% 44%)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}€`}
              width={50}
            />
            <YAxis
              yAxisId="impressions"
              orientation="right"
              tick={{ fontSize: 10, fill: "hsl(252 12% 44%)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatNumber}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              yAxisId="spend"
              type="monotone"
              dataKey="spend"
              stroke="#7c3aed"
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, fill: "#7c3aed", strokeWidth: 2, stroke: "white" }}
            />
            <Line
              yAxisId="impressions"
              type="monotone"
              dataKey="impressions"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#8b5cf6", strokeWidth: 2, stroke: "white" }}
              strokeDasharray="4 2"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
