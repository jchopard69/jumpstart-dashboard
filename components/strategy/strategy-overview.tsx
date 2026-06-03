import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ClientStrategySnapshot, StrategyActionItem } from "@/lib/client-strategy";
import { splitStrategyLines } from "@/lib/client-strategy";
import { buildStrategyHealth } from "@/lib/strategy-health";
import { StrategyHealthCard } from "./strategy-health-card";
import { CalendarDays, CheckCircle2, Clock3, Sparkles, Target, UserRoundCheck } from "lucide-react";

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

function isDueSoon(value: string | null) {
  if (!value) return false;
  const due = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 7;
}

function countFilledBlocks(profile: ClientStrategySnapshot["profile"]) {
  if (!profile) return 0;
  return [
    profile.positioning,
    profile.target_audience,
    profile.offer_focus,
    profile.brand_voice,
    profile.editorial_pillars,
    profile.current_quarter_objectives,
    profile.monthly_focus,
    profile.jumpstart_note,
  ].filter((value) => splitStrategyLines(value).length > 0).length;
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
  const activeActions = actionItems.filter((item) => item.status !== "done");
  const completedCount = actionItems.length - activeActions.length;
  const urgentActions = activeActions.filter((item) => item.priority === "critical" || item.priority === "high" || isDueSoon(item.due_date));
  const strategyCoverage = countFilledBlocks(profile);
  const strategyHealth = buildStrategyHealth({ snapshot });
  const nextAction =
    activeActions.find((item) => item.priority === "critical" || item.priority === "high") ??
    activeActions[0] ??
    null;

  return (
    <div className="space-y-8">
      <section className="surface-panel p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <p className="section-label">Espace stratégique JumpStart</p>
            <h1 className="page-heading mt-1">Votre direction du moment</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Un espace réservé aux clients JumpStart pour suivre les priorités, les décisions et les prochaines actions issues de vos performances.
            </p>
          </div>
          <div className="rounded-2xl border border-primary/15 bg-primary/5 px-5 py-4">
            <p className="section-label text-primary">Focus actuel</p>
            <p className="mt-1 max-w-sm text-sm font-medium text-foreground">
              {profile?.monthly_focus || "Priorité mensuelle en cours de préparation."}
            </p>
          </div>
        </div>
      </section>

      <StrategyHealthCard health={strategyHealth} />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="card-surface p-5">
          <p className="section-label">Plan actif</p>
          <h2 className="mt-2 text-lg font-semibold">
            {activeActions.length} action{activeActions.length > 1 ? "s" : ""} à suivre
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {urgentActions.length > 0
              ? `${urgentActions.length} priorité${urgentActions.length > 1 ? "s" : ""} à traiter rapidement.`
              : "Aucune urgence détectée dans le plan actuel."}
          </p>
        </Card>
        <Card className="card-surface p-5">
          <p className="section-label">Prochaine action</p>
          <h2 className="mt-2 text-lg font-semibold">
            {nextAction?.title ?? "À définir"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {nextAction
              ? `${OWNER_LABELS[nextAction.owner]} · ${PRIORITY_LABELS[nextAction.priority]}${nextAction.due_date ? ` · échéance ${formatDate(nextAction.due_date)}` : ""}`
              : "Le prochain chantier stratégique sera ajouté après analyse."}
          </p>
        </Card>
        <Card className="card-surface p-5">
          <p className="section-label">Cadre stratégique</p>
          <h2 className="mt-2 text-lg font-semibold">{strategyCoverage}/8 blocs</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {latestBrief
              ? `Dernier brief : ${formatMonth(latestBrief.period_month)}.`
              : "Brief mensuel en préparation."}
          </p>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StrategyBlock title="Positionnement" value={profile?.positioning} icon={<Sparkles className="h-4 w-4" aria-hidden="true" />} />
        <StrategyBlock title="Cibles prioritaires" value={profile?.target_audience} icon={<UserRoundCheck className="h-4 w-4" aria-hidden="true" />} />
        <StrategyBlock title="Objectifs du trimestre" value={profile?.current_quarter_objectives} icon={<Target className="h-4 w-4" aria-hidden="true" />} />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="card-surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="section-label">Brief mensuel</p>
              <h2 className="section-title mt-1">{latestBrief?.title ?? "Brief JumpStart en préparation"}</h2>
            </div>
            <Badge variant="secondary">{formatMonth(latestBrief?.period_month)}</Badge>
          </div>

          {latestBrief ? (
            <div className="mt-5 space-y-5">
              <p className="text-sm leading-relaxed text-muted-foreground">{latestBrief.executive_summary}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold">Ce qui a créé de la valeur</h3>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{latestBrief.wins || "-"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Ce qu'on ajuste</h3>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{latestBrief.learnings || "-"}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                <h3 className="text-sm font-semibold">Prochain focus</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{latestBrief.next_focus || "-"}</p>
              </div>
            </div>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">
              Le prochain brief stratégique sera publié ici par l'équipe JumpStart.
            </p>
          )}
        </Card>

        <Card className="card-surface p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-label">Plan d'action</p>
              <h2 className="section-title mt-1">À suivre maintenant</h2>
            </div>
            <Badge variant="outline">{activeActions.length} actif{activeActions.length > 1 ? "s" : ""}</Badge>
          </div>

          <div className="mt-5 space-y-3">
            {actionItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/5 text-primary">
                    <Clock3 className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">Plan d'action en préparation</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      Les prochaines actions seront ajoutées après la prochaine analyse. Elles permettront de clarifier responsable, priorité, impact attendu et échéance.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              actionItems.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border/60 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={item.priority === "critical" || item.priority === "high" ? "danger" : "outline"}>
                      {PRIORITY_LABELS[item.priority]}
                    </Badge>
                    <Badge variant={item.status === "done" ? "success" : item.status === "in_progress" ? "warning" : "secondary"}>
                      {STATUS_LABELS[item.status]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{OWNER_LABELS[item.owner]}</span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
                  {item.rationale && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.rationale}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {item.expected_impact && (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {item.expected_impact}
                      </span>
                    )}
                    {item.due_date && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatDate(item.due_date)}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {completedCount > 0 && (
            <p className="mt-4 text-xs text-muted-foreground">
              {completedCount} action{completedCount > 1 ? "s" : ""} déjà finalisée{completedCount > 1 ? "s" : ""}.
            </p>
          )}
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StrategyBlock title="Piliers éditoriaux" value={profile?.editorial_pillars} icon={<Sparkles className="h-4 w-4" aria-hidden="true" />} />
        <StrategyBlock title="Offre à pousser" value={profile?.offer_focus} icon={<Target className="h-4 w-4" aria-hidden="true" />} />
        <StrategyBlock title="Note JumpStart" value={profile?.jumpstart_note} icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />} />
      </section>
    </div>
  );
}
