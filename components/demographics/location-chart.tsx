"use client";

import { useId } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { Card } from "@/components/ui/card";

type LocationEntry = {
  value: string;
  percentage: number;
};

type LocationChartProps = {
  data: LocationEntry[];
  title: string;
  subtitle: string;
  variant?: "country" | "city";
  maxItems?: number;
};

const COUNTRY_FLAGS: Record<string, string> = {
  FR: "\u{1F1EB}\u{1F1F7}",
  US: "\u{1F1FA}\u{1F1F8}",
  GB: "\u{1F1EC}\u{1F1E7}",
  DE: "\u{1F1E9}\u{1F1EA}",
  ES: "\u{1F1EA}\u{1F1F8}",
  IT: "\u{1F1EE}\u{1F1F9}",
  PT: "\u{1F1F5}\u{1F1F9}",
  BE: "\u{1F1E7}\u{1F1EA}",
  CH: "\u{1F1E8}\u{1F1ED}",
  CA: "\u{1F1E8}\u{1F1E6}",
  BR: "\u{1F1E7}\u{1F1F7}",
  MX: "\u{1F1F2}\u{1F1FD}",
  NL: "\u{1F1F3}\u{1F1F1}",
  AU: "\u{1F1E6}\u{1F1FA}",
  JP: "\u{1F1EF}\u{1F1F5}",
  IN: "\u{1F1EE}\u{1F1F3}",
  CN: "\u{1F1E8}\u{1F1F3}",
  KR: "\u{1F1F0}\u{1F1F7}",
  RU: "\u{1F1F7}\u{1F1FA}",
  AR: "\u{1F1E6}\u{1F1F7}",
  MA: "\u{1F1F2}\u{1F1E6}",
  DZ: "\u{1F1E9}\u{1F1FF}",
  TN: "\u{1F1F9}\u{1F1F3}",
  SN: "\u{1F1F8}\u{1F1F3}",
  CI: "\u{1F1E8}\u{1F1EE}",
  CM: "\u{1F1E8}\u{1F1F2}",
  LB: "\u{1F1F1}\u{1F1E7}",
  AE: "\u{1F1E6}\u{1F1EA}",
  SA: "\u{1F1F8}\u{1F1E6}",
  PL: "\u{1F1F5}\u{1F1F1}",
  SE: "\u{1F1F8}\u{1F1EA}",
  NO: "\u{1F1F3}\u{1F1F4}",
  DK: "\u{1F1E9}\u{1F1F0}",
  FI: "\u{1F1EB}\u{1F1EE}",
  AT: "\u{1F1E6}\u{1F1F9}",
  IE: "\u{1F1EE}\u{1F1EA}",
  NZ: "\u{1F1F3}\u{1F1FF}",
  SG: "\u{1F1F8}\u{1F1EC}",
  ZA: "\u{1F1FF}\u{1F1E6}",
  CL: "\u{1F1E8}\u{1F1F1}",
  CO: "\u{1F1E8}\u{1F1F4}",
  TR: "\u{1F1F9}\u{1F1F7}",
  IL: "\u{1F1EE}\u{1F1F1}",
  EG: "\u{1F1EA}\u{1F1EC}",
  NG: "\u{1F1F3}\u{1F1EC}",
  GH: "\u{1F1EC}\u{1F1ED}",
  TH: "\u{1F1F9}\u{1F1ED}",
  ID: "\u{1F1EE}\u{1F1E9}",
  PH: "\u{1F1F5}\u{1F1ED}",
  VN: "\u{1F1FB}\u{1F1F3}",
  MY: "\u{1F1F2}\u{1F1FE}",
  PK: "\u{1F1F5}\u{1F1F0}",
  BD: "\u{1F1E7}\u{1F1E9}",
  RO: "\u{1F1F7}\u{1F1F4}",
  GR: "\u{1F1EC}\u{1F1F7}",
  CZ: "\u{1F1E8}\u{1F1FF}",
  HU: "\u{1F1ED}\u{1F1FA}",
  LU: "\u{1F1F1}\u{1F1FA}",
  MC: "\u{1F1F2}\u{1F1E8}",
  RE: "\u{1F1F7}\u{1F1EA}",
  GP: "\u{1F1EC}\u{1F1F5}",
  MQ: "\u{1F1F2}\u{1F1F6}",
  GF: "\u{1F1EC}\u{1F1EB}",
};

function getFlag(code: string): string {
  return COUNTRY_FLAGS[code.toUpperCase()] ?? "";
}

export function LocationChart({
  data,
  title,
  subtitle,
  variant = "country",
  maxItems = 10,
}: LocationChartProps) {
  const gradientId = useId();
  const items = data.slice(0, maxItems);

  const iconBg =
    variant === "country" ? "bg-purple-500/10" : "bg-violet-500/10";
  const iconColor =
    variant === "country" ? "text-purple-600" : "text-violet-600";

  if (items.length === 0) {
    return (
      <Card className="card-surface p-5 fade-in-up">
        <div className="mb-3 flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}
          >
            <svg
              className={`h-4 w-4 ${iconColor}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
              />
            </svg>
          </div>
          <h3 className="section-title">{title}</h3>
        </div>
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-muted-foreground">Aucune donnee</p>
        </div>
      </Card>
    );
  }

  const chartData = items.map((entry) => ({
    ...entry,
    label:
      variant === "country"
        ? `${getFlag(entry.value)} ${entry.value}`
        : entry.value,
  }));

  const chartHeight = Math.max(200, items.length * 32 + 40);

  return (
    <Card className="card-surface p-5 fade-in-up">
      <div className="mb-4 flex items-center gap-2">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}
        >
          <svg
            className={`h-4 w-4 ${iconColor}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
            />
          </svg>
        </div>
        <div>
          <h3 className="section-title">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ left: 4, right: 40, top: 4, bottom: 4 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.75} />
                <stop offset="100%" stopColor="#a855f7" stopOpacity={0.9} />
              </linearGradient>
            </defs>
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: "hsl(252 12% 44%)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
              domain={[0, "auto"]}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 11, fill: "hsl(252 12% 30%)" }}
              axisLine={false}
              tickLine={false}
              width={70}
            />
            <Bar
              dataKey="percentage"
              radius={[0, 6, 6, 0]}
              fill={`url(#${gradientId})`}
              maxBarSize={24}
            >
              <LabelList
                dataKey="percentage"
                position="right"
                formatter={(v: number) => `${v}%`}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  fill: "hsl(252 12% 30%)",
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
