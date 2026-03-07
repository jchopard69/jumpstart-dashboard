"use client";

import { useId } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { Card } from "@/components/ui/card";

type AgeEntry = {
  value: string;
  percentage: number;
};

type AgeChartProps = {
  data: AgeEntry[];
};

export function AgeChart({ data }: AgeChartProps) {
  const gradientId = useId();

  if (data.length === 0) {
    return (
      <Card className="card-surface p-5 fade-in-up">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
            <svg
              className="h-4 w-4 text-purple-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
              />
            </svg>
          </div>
          <h3 className="section-title">Tranches d&apos;age</h3>
        </div>
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-muted-foreground">Aucune donnee</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="card-surface p-5 fade-in-up">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
          <svg
            className="h-4 w-4 text-purple-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
            />
          </svg>
        </div>
        <div>
          <h3 className="section-title">Tranches d&apos;age</h3>
          <p className="text-xs text-muted-foreground">
            Repartition par groupe d&apos;age
          </p>
        </div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 4, right: 40, top: 4, bottom: 4 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.85} />
                <stop offset="100%" stopColor="#a855f7" stopOpacity={0.95} />
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
              dataKey="value"
              tick={{ fontSize: 11, fill: "hsl(252 12% 30%)" }}
              axisLine={false}
              tickLine={false}
              width={50}
            />
            <Bar
              dataKey="percentage"
              radius={[0, 6, 6, 0]}
              fill={`url(#${gradientId})`}
              maxBarSize={28}
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
