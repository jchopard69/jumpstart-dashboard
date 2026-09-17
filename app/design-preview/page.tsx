import { notFound } from "next/navigation";
import { ScoreCard } from "@/components/dashboard/score-card";
import { KpiSection } from "@/components/dashboard/kpi-section";
import { ChartsSection } from "@/components/dashboard/charts-section";
import { PlatformBreakdownCard } from "@/components/dashboard/platform-breakdown-card";
import { DashboardSectionNav } from "@/components/dashboard/dashboard-section-nav";
import { EditorialRoadmap } from "@/components/dashboard/editorial-roadmap";
import { computeJumpStartScore } from "@/lib/scoring";
import { buildEditorialRoadmap } from "@/lib/editorial-roadmap";

// Local visual fixture only. Production always returns 404 and never reads tenant data.
export default function DesignPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  const totals = { followers: 15450, views: 187400, reach: 112300, engagements: 6340, posts_count: 18 };
  const delta = { followers: 3.7, views: 18.3, reach: 11.2, engagements: 21.4, posts_count: 12.5 };
  const score = computeJumpStartScore({ ...totals, postsCount: 18, prevFollowers: 14900, prevViews: 158400, prevReach: 101000, prevEngagements: 5200, prevPostsCount: 16, periodDays: 31 });
  const points = Array.from({ length: 31 }, (_, day) => ({ date: `2026-08-${String(day + 1).padStart(2, "0")}`, value: 1600 + (day % 9) * 380 + day * 75, previousValue: 1200 + (day % 7) * 240 }));
  return <div className="min-h-screen bg-[#f7f7fa] px-4 py-8 sm:px-8"><div className="report-workspace mx-auto max-w-[1100px] space-y-10">
    <header className="space-y-5"><p className="section-label text-primary">JumpStart Studio · exemple fictif</p><div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="page-heading">Atelier Horizon</h1><p className="mt-2 text-sm text-muted-foreground">Bilan du 1 au 31 août 2026</p></div><span className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">Aperçu local du design</span></div><DashboardSectionNav /></header>
    <ScoreCard score={score} takeaways={["Audience en progression : +3,7%", "18 publications sur la période", "Interactions en hausse : +21,4%"]} executiveSummary="Votre audience et vos interactions progressent. Examinez les résultats par canal avant de choisir les contenus à décliner pour le prochain cycle." dataCoverage={96} postsAnalyzed={18} />
    <section id="dashboard-kpis"><KpiSection totals={totals} delta={delta} showViews showReach showEngagements comparisonLabel="01/07/2026 - 31/07/2026" /></section>
    <PlatformBreakdownCard platforms={[{ platform: "instagram", totals, delta, available: { views: true, reach: true, engagements: true } }]} />
    <ChartsSection trendFollowers={points.map(point => ({ ...point, value: point.value + 10000 }))} trendViews={points} trendReach={points} trendEngagements={points.map(point => ({ ...point, value: point.value / 30 }))} showViews showReach showEngagements showComparison />
    <EditorialRoadmap experiments={buildEditorialRoadmap([], 96)} />
    <details className="dashboard-detail"><summary>Qualité des données et suivi de la collaboration</summary><p className="pt-4 text-sm">Données fictives utilisées uniquement pour la vérification visuelle des composants.</p></details>
  </div></div>;
}
export const dynamic = "force-dynamic";
