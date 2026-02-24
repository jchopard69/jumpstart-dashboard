"use client";

import { Card } from "@/components/ui/card";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import type { ScoreSnapshotRow } from "@/lib/score-history";

type ScoreTrendProps = {
  history: ScoreSnapshotRow[];
};

const gradeColors: Record<string, string> = {
  "A+": "#10b981", "A": "#10b981",
  "B+": "#3b82f6", "B": "#3b82f6",
  "C+": "#f59e0b", "C": "#f59e0b",
  "D": "#f43f5e",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-xl border border-border/60 bg-white px-3 py-2 shadow-soft text-xs">
      <p className="font-medium">{formatDate(data.snapshot_date)}</p>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-2xl font-bold font-display tabular-nums">{data.global_score}</span>
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
          style={{ backgroundColor: gradeColors[data.grade] ?? "#8b5cf6" }}
        >
          {data.grade}
        </span>
      </div>
    </div>
  );
}

export function ScoreTrend({ history }: ScoreTrendProps) {
  if (history.length < 2) return null;

  const first = history[0];
  const last = history[history.length - 1];
  const delta = last.global_score - first.global_score;

  return (
    <Card className="card-surface p-6 fade-in-up">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
            <svg className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
          </div>
          <div>
            <h2 className="section-title">Evolution du score</h2>
            <p className="text-xs text-muted-foreground">Progression de votre JumpStart Score</p>
          </div>
        </div>
        {delta !== 0 && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
              delta > 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
            }`}
          >
            {delta > 0 ? "+" : ""}{delta} pts
          </span>
        )}
      </div>

      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
            <defs>
              <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
            <XAxis
              dataKey="snapshot_date"
              tickFormatter={formatDate}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              ticks={[0, 25, 50, 75, 100]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="global_score"
              stroke="#8b5cf6"
              strokeWidth={2}
              fill="url(#scoreFill)"
              dot={{ r: 3, fill: "#8b5cf6", stroke: "#fff", strokeWidth: 2 }}
              activeDot={{ r: 5, fill: "#8b5cf6", stroke: "#fff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
