import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type InsightType = "positive" | "negative" | "neutral" | "warning";

type Insight = {
  type: InsightType;
  title: string;
  description: string;
};

type InsightCardProps = {
  insights: Insight[];
};

const typeStyles: Record<InsightType, { bg: string; text: string; iconBg: string; icon: React.ReactNode }> = {
  positive: {
    bg: "bg-emerald-50/80 border-emerald-200/60",
    text: "text-emerald-700",
    iconBg: "bg-emerald-100",
    icon: (
      <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    )
  },
  negative: {
    bg: "bg-rose-50/80 border-rose-200/60",
    text: "text-rose-700",
    iconBg: "bg-rose-100",
    icon: (
      <svg className="h-4 w-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
      </svg>
    )
  },
  neutral: {
    bg: "bg-slate-50/80 border-slate-200/60",
    text: "text-slate-700",
    iconBg: "bg-slate-100",
    icon: (
      <svg className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
      </svg>
    )
  },
  warning: {
    bg: "bg-amber-50/80 border-amber-200/60",
    text: "text-amber-700",
    iconBg: "bg-amber-100",
    icon: (
      <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    )
  }
};

export function InsightCard({ insights }: InsightCardProps) {
  return (
    <Card className="card-surface p-6 fade-in-up lg:col-span-2">
      <div className="flex items-center gap-2 mb-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
          <svg className="h-4.5 w-4.5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
          </svg>
        </div>
        <div>
          <h2 className="section-title">Analyse strategique</h2>
          <p className="text-xs text-muted-foreground">Insights cles et recommandations.</p>
        </div>
      </div>

      {insights.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-center">
          <div>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground">Performances stables</p>
            <p className="text-xs text-muted-foreground mt-1">Continuez sur cette dynamique.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {insights.map((insight, index) => {
            const style = typeStyles[insight.type];
            return (
              <div
                key={index}
                className={cn(
                  "rounded-xl border p-4 transition-colors",
                  style.bg
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("shrink-0 mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center", style.iconBg)}>
                    {style.icon}
                  </div>
                  <div className="min-w-0">
                    <p className={cn("text-sm font-medium", style.text)}>{insight.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{insight.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export function generateInsights(data: {
  totals: { followers?: number; views?: number; engagements?: number } | null;
  delta: { followers: number; views: number; engagements: number };
}): Insight[] {
  const insights: Insight[] = [];

  if (data.delta.followers > 20) {
    insights.push({
      type: "positive",
      title: "Croissance des abonnés",
      description: `Votre audience a augmenté de ${Math.round(data.delta.followers)}% sur la période. Continuez sur cette lancée !`
    });
  } else if (data.delta.followers < -10) {
    insights.push({
      type: "negative",
      title: "Baisse des abonnés",
      description: `Votre audience a diminué de ${Math.abs(Math.round(data.delta.followers))}%. Analysez les contenus récents pour comprendre ce changement.`
    });
  }

  if (data.delta.engagements > 30) {
    insights.push({
      type: "positive",
      title: "Engagement en hausse",
      description: `L'engagement a augmenté de ${Math.round(data.delta.engagements)}%. Vos contenus résonnent bien avec votre audience.`
    });
  } else if (data.delta.engagements < -20) {
    insights.push({
      type: "warning",
      title: "Engagement en baisse",
      description: `L'engagement a baissé de ${Math.abs(Math.round(data.delta.engagements))}%. Pensez à varier vos formats de contenu.`
    });
  }

  if (data.totals?.views && data.totals?.engagements) {
    const engagementRate = (data.totals.engagements / data.totals.views) * 100;
    if (engagementRate > 5) {
      insights.push({
        type: "positive",
        title: "Excellent taux d'engagement",
        description: `Avec ${engagementRate.toFixed(1)}% d'engagement, vous êtes au-dessus de la moyenne du secteur.`
      });
    } else if (engagementRate < 1) {
      insights.push({
        type: "warning",
        title: "Taux d'engagement faible",
        description: `Le taux d'engagement de ${engagementRate.toFixed(1)}% pourrait être amélioré avec plus d'appels à l'action.`
      });
    }
  }

  return insights.slice(0, 3);
}
