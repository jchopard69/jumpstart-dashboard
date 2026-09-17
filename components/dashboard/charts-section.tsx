"use client";

import { useState } from "react";
import { TrendChart } from "./trend-chart";
import type { TrendPoint } from "@/lib/types/dashboard";

type ChartsSectionProps = {
  trendFollowers: TrendPoint[];
  trendViews: TrendPoint[];
  trendEngagements: TrendPoint[];
  trendReach: TrendPoint[];
  showViews: boolean;
  showReach: boolean;
  showEngagements: boolean;
  showComparison?: boolean;
};

export function ChartsSection(props: ChartsSectionProps) {
  const [selected, setSelected] = useState("views");
  const options = [
    { key: "followers", label: "Abonnés", data: props.trendFollowers, visible: true },
    { key: "views", label: "Vues", data: props.trendViews, visible: props.showViews },
    { key: "engagements", label: "Interactions", data: props.trendEngagements, visible: props.showEngagements },
    { key: "reach", label: "Portée cumulée", data: props.trendReach, visible: props.showReach },
  ].filter(option => option.visible);
  const active = options.find(option => option.key === selected) ?? options[0];
  return <section className="space-y-4" aria-label="Évolution des résultats">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Évolution sur la période</h2>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Indicateur du graphique">{options.map(option => <button key={option.key} type="button" aria-pressed={active.key === option.key} onClick={() => setSelected(option.key)} className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${active.key === option.key ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}>{option.label}</button>)}</div>
    </div>
    <TrendChart key={active.key} title={active.label} data={active.data} showComparison={props.showComparison ?? false} showTrend={false} />
  </section>;
}
