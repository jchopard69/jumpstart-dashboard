"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/card";

type GenderEntry = {
  value: string;
  percentage: number;
};

type GenderChartProps = {
  data: GenderEntry[];
};

const GENDER_LABELS: Record<string, string> = {
  male: "Hommes",
  M: "Hommes",
  female: "Femmes",
  F: "Femmes",
  undisclosed: "Autre",
  U: "Autre",
};

const GENDER_COLORS: Record<string, string> = {
  Hommes: "#8b5cf6",
  Femmes: "#a78bfa",
  Autre: "#9ca3af",
};

function normalizeGenderData(data: GenderEntry[]) {
  const grouped = new Map<string, number>();

  for (const entry of data) {
    const label = GENDER_LABELS[entry.value] ?? GENDER_LABELS[entry.value.toLowerCase()] ?? "Autre";
    grouped.set(label, (grouped.get(label) ?? 0) + entry.percentage);
  }

  return Array.from(grouped.entries())
    .map(([name, percentage]) => ({
      name,
      value: Math.round(percentage * 10) / 10,
      color: GENDER_COLORS[name] ?? "#9ca3af",
    }))
    .sort((a, b) => b.value - a.value);
}

const RADIAN = Math.PI / 180;

function renderCustomLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  name,
  value,
}: any) {
  const radius = outerRadius + 24;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="hsl(252 12% 30%)"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      fontSize={11}
      fontWeight={500}
    >
      {name} {value}%
    </text>
  );
}

export function GenderChart({ data }: GenderChartProps) {
  if (data.length === 0) {
    return (
      <Card className="card-surface p-5 fade-in-up">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
            <svg
              className="h-4 w-4 text-violet-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z"
              />
            </svg>
          </div>
          <h3 className="section-title">Genre</h3>
        </div>
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-muted-foreground">Aucune donnee</p>
        </div>
      </Card>
    );
  }

  const chartData = normalizeGenderData(data);
  const dominant = chartData[0];

  return (
    <Card className="card-surface p-5 fade-in-up">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
          <svg
            className="h-4 w-4 text-violet-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z"
            />
          </svg>
        </div>
        <div>
          <h3 className="section-title">Genre</h3>
          <p className="text-xs text-muted-foreground">
            Repartition par genre
          </p>
        </div>
      </div>
      <div className="relative h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              dataKey="value"
              stroke="none"
              label={renderCustomLabel}
              labelLine={false}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-xl font-bold font-display tabular-nums text-foreground">
              {dominant?.value ?? 0}%
            </p>
            <p className="text-[10px] font-medium text-muted-foreground">
              {dominant?.name ?? ""}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
