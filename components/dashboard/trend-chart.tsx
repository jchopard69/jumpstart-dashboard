"use client";

import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";

export type TrendPoint = {
  date: string;
  value: number;
};

export function TrendChart({ title, data }: { title: string; data: TrendPoint[] }) {
  const gradientId = useId();

  return (
    <Card className="card-surface p-4 fade-in-up">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.85} />
                <stop offset="100%" stopColor="#a855f7" stopOpacity={0.08} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: "rgba(255,255,255,0.9)",
                borderRadius: "12px",
                border: "1px solid rgba(214,210,235,0.6)",
                boxShadow: "0 10px 30px rgba(24, 16, 62, 0.12)"
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#7c3aed"
              fillOpacity={1}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
