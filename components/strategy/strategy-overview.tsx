import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ClientStrategySnapshot, StrategyActionItem } from "@/lib/client-strategy";
import { splitStrategyLines } from "@/lib/client-strategy";
import { Target } from "lucide-react";

const STATUS_LABELS: Record<StrategyActionItem["status"], string> = {
  recommended: "Recommandé",
  planned: "Planifié",
  in_progress: "En cours",
  done: "Fait",
  paused: "En pause",
};

const OWNER_LABELS: Record<StrategyActionItem["owner"], string> = {
  jumpstart: "JumpStart",
  client: "Client",
  shared: "Partagé",
};

const PRIORITY_LABELS: Record<StrategyActionItem["priority"], string> = {
  low: "Confort",
  medium: "Important",
  high: "Prioritaire",
  critical: "Critique",
};

function formatMonth(value: string | null | undefined) {
  if (!value) return "Dernier brief";
  return new Date(value).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function StrategyBlock({
  title,
  value,
  icon,
}: {
  title: string;
  value: string | null | undefined;
  icon: React.ReactNode;
}) {
  const lines = splitStrategyLines(value);
  if (!lines.length) return null;
  return (
    <Card className="card-surface p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/15 bg-primary/5 text-primary">
          {icon}
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {lines.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {lines.map((line) => (
            <li key={line} className="text-sm leading-relaxed text-muted-foreground">
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">À formaliser avec l'équipe JumpStart.</p>
      )}
    </Card>
  );
}

export function StrategyOverview({ snapshot }: { snapshot: ClientStrategySnapshot }) {
  const { profile, latestBrief, actionItems } = snapshot;
  const fields = [{title:"Positionnement",value:profile?.positioning},{title:"Cibles prioritaires",value:profile?.target_audience},{title:"Objectifs du trimestre",value:profile?.current_quarter_objectives},{title:"Piliers éditoriaux",value:profile?.editorial_pillars},{title:"Offre à mettre en avant",value:profile?.offer_focus},{title:"Voix de marque",value:profile?.brand_voice},{title:"Note JumpStart",value:profile?.jumpstart_note}];
  const hasContent=latestBrief || actionItems.length || fields.some(f=>f.value) || profile?.monthly_focus;
  return <div className="review-app"><header className="review-header"><p className="review-eyebrow">Votre accompagnement</p><h1>La direction éditoriale<span className="review-title-caption">Les briefs et décisions de votre équipe JumpStart.</span></h1></header><div className="review-panel space-y-7">
    {!hasContent && <div className="review-empty"><h2>Aucune orientation publiée pour le moment</h2><p>Les briefs et les décisions validés par l’agence apparaîtront ici. Les résultats sont disponibles dans votre bilan social media.</p></div>}
    {profile?.monthly_focus && <section className="review-notice"><h3>Priorité du mois</h3><p>{profile.monthly_focus}</p></section>}
    {latestBrief && <section className="card-surface p-6"><p className="review-eyebrow">Brief · {formatMonth(latestBrief.period_month)}</p><h2>{latestBrief.title}</h2><p className="mt-4 whitespace-pre-line">{latestBrief.executive_summary}</p><div className="mt-6 grid gap-6 md:grid-cols-3">{[{title:"Résultats à retenir",value:latestBrief.wins},{title:"Enseignements",value:latestBrief.learnings},{title:"Prochain focus",value:latestBrief.next_focus}].filter(f=>f.value).map(f=><div key={f.title}><h3>{f.title}</h3><p className="mt-2 whitespace-pre-line">{f.value}</p></div>)}</div></section>}
    {actionItems.length>0 && <section><h2>Les décisions à suivre</h2><div className="mt-4 divide-y divide-border">{actionItems.map(item=><article key={item.id} className="py-5"><div className="flex flex-wrap gap-2"><Badge variant="outline">{STATUS_LABELS[item.status]}</Badge><span className="review-small">{OWNER_LABELS[item.owner]} · {PRIORITY_LABELS[item.priority]}{item.due_date?` · ${formatDate(item.due_date)}`:''}</span></div><h3 className="mt-3">{item.title}</h3>{item.rationale&&<p className="mt-2">{item.rationale}</p>}{item.expected_impact&&<p className="review-small mt-2">Objectif : {item.expected_impact}</p>}</article>)}</div></section>}
    <section className="grid gap-5 md:grid-cols-2">{fields.map(f=><StrategyBlock key={f.title} title={f.title} value={f.value} icon={<Target className="h-4 w-4"/>}/>)}</section>
  </div></div>;
}
