import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { ClientStrategySnapshot, StrategyActionItem } from "@/lib/client-strategy";
import { STRATEGY_ACTION_STATUSES } from "@/lib/strategy-actions";

type Props = {
  tenantId: string;
  snapshot: ClientStrategySnapshot;
  isDemoTenant: boolean;
  updateProfileAction: (formData: FormData) => Promise<void>;
  upsertBriefAction: (formData: FormData) => Promise<void>;
  addActionItemAction: (formData: FormData) => Promise<void>;
  updateActionStatusAction: (formData: FormData) => Promise<void>;
};

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

export function AdminStrategyForms({
  tenantId,
  snapshot,
  isDemoTenant,
  updateProfileAction,
  upsertBriefAction,
  addActionItemAction,
  updateActionStatusAction,
}: Props) {
  const profile = snapshot.profile;
  const brief = snapshot.latestBrief;
  const periodMonth = brief?.period_month?.slice(0, 7) ?? new Date().toISOString().slice(0, 7);

  return (
    <div className="space-y-6">
      <Card className="card-surface p-6 fade-in-up">
        <h2 className="section-title">Stratégie client JumpStart</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ces éléments alimentent l'espace privilégié visible côté client.
        </p>
        <form action={updateProfileAction} className="mt-5 grid gap-4 md:grid-cols-2">
          <input type="hidden" name="tenant_id" value={tenantId} />
          <div>
            <Label>Positionnement</Label>
            <Textarea name="positioning" rows={4} defaultValue={profile?.positioning ?? ""} disabled={isDemoTenant} />
          </div>
          <div>
            <Label>Cibles prioritaires</Label>
            <Textarea name="target_audience" rows={4} defaultValue={profile?.target_audience ?? ""} disabled={isDemoTenant} />
          </div>
          <div>
            <Label>Offre à pousser</Label>
            <Textarea name="offer_focus" rows={3} defaultValue={profile?.offer_focus ?? ""} disabled={isDemoTenant} />
          </div>
          <div>
            <Label>Ton de marque</Label>
            <Textarea name="brand_voice" rows={3} defaultValue={profile?.brand_voice ?? ""} disabled={isDemoTenant} />
          </div>
          <div>
            <Label>Piliers éditoriaux</Label>
            <Textarea name="editorial_pillars" rows={4} defaultValue={profile?.editorial_pillars ?? ""} disabled={isDemoTenant} />
          </div>
          <div>
            <Label>Objectifs du trimestre</Label>
            <Textarea name="current_quarter_objectives" rows={4} defaultValue={profile?.current_quarter_objectives ?? ""} disabled={isDemoTenant} />
          </div>
          <div>
            <Label>Focus du mois</Label>
            <Input name="monthly_focus" defaultValue={profile?.monthly_focus ?? ""} disabled={isDemoTenant} />
          </div>
          <div>
            <Label>Note JumpStart visible client</Label>
            <Input name="jumpstart_note" defaultValue={profile?.jumpstart_note ?? ""} disabled={isDemoTenant} />
          </div>
          <Button type="submit" disabled={isDemoTenant}>Sauvegarder la stratégie</Button>
        </form>
      </Card>

      <Card className="card-surface p-6 fade-in-up">
        <h2 className="section-title">Brief mensuel premium</h2>
        <form action={upsertBriefAction} className="mt-5 grid gap-4 md:grid-cols-2">
          <input type="hidden" name="tenant_id" value={tenantId} />
          <div>
            <Label>Mois</Label>
            <Input name="period_month" type="month" defaultValue={periodMonth} disabled={isDemoTenant} />
          </div>
          <div>
            <Label>Titre</Label>
            <Input name="title" defaultValue={brief?.title ?? "Brief mensuel JumpStart"} disabled={isDemoTenant} />
          </div>
          <div className="md:col-span-2">
            <Label>Résumé exécutif</Label>
            <Textarea name="executive_summary" rows={3} defaultValue={brief?.executive_summary ?? ""} disabled={isDemoTenant} />
          </div>
          <div>
            <Label>Ce qui a créé de la valeur</Label>
            <Textarea name="wins" rows={4} defaultValue={brief?.wins ?? ""} disabled={isDemoTenant} />
          </div>
          <div>
            <Label>Ce qu'on ajuste</Label>
            <Textarea name="learnings" rows={4} defaultValue={brief?.learnings ?? ""} disabled={isDemoTenant} />
          </div>
          <div>
            <Label>Prochain focus</Label>
            <Textarea name="next_focus" rows={4} defaultValue={brief?.next_focus ?? ""} disabled={isDemoTenant} />
          </div>
          <div>
            <Label>Demandes côté client</Label>
            <Textarea name="client_requests" rows={4} defaultValue={brief?.client_requests ?? ""} disabled={isDemoTenant} />
          </div>
          <div className="md:col-span-2">
            <Label>Actions côté JumpStart</Label>
            <Textarea name="jumpstart_actions" rows={3} defaultValue={brief?.jumpstart_actions ?? ""} disabled={isDemoTenant} />
          </div>
          <Button type="submit" disabled={isDemoTenant}>Publier le brief</Button>
        </form>
      </Card>

      <Card className="card-surface p-6 fade-in-up">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="section-title">Actions stratégiques</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pilotez les recommandations visibles côté client et leur état d'avancement.
            </p>
          </div>
          <Badge variant="secondary">{snapshot.actionItems.length} action{snapshot.actionItems.length > 1 ? "s" : ""}</Badge>
        </div>

        {snapshot.actionItems.length > 0 && (
          <div className="mt-5 space-y-3">
            {snapshot.actionItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={item.priority === "critical" || item.priority === "high" ? "danger" : "outline"}>
                        {PRIORITY_LABELS[item.priority]}
                      </Badge>
                      <Badge variant={item.status === "done" ? "success" : item.status === "in_progress" ? "warning" : "secondary"}>
                        {STATUS_LABELS[item.status]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{OWNER_LABELS[item.owner]}</span>
                    </div>
                    <p className="mt-3 text-sm font-semibold">{item.title}</p>
                    {item.rationale && (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.rationale}</p>
                    )}
                    {item.expected_impact && (
                      <p className="mt-2 text-xs font-medium text-foreground/75">Impact attendu: {item.expected_impact}</p>
                    )}
                  </div>
                  <form action={updateActionStatusAction} className="flex shrink-0 items-end gap-2">
                    <input type="hidden" name="tenant_id" value={tenantId} />
                    <input type="hidden" name="action_id" value={item.id} />
                    <div>
                      <Label>Statut</Label>
                      <select
                        name="status"
                        defaultValue={item.status}
                        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                        disabled={isDemoTenant}
                      >
                        {STRATEGY_ACTION_STATUSES.map((status) => (
                          <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                        ))}
                      </select>
                    </div>
                    <Button type="submit" variant="outline" disabled={isDemoTenant}>Mettre à jour</Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}

        <form action={addActionItemAction} className="mt-5 grid gap-4 md:grid-cols-4">
          <input type="hidden" name="tenant_id" value={tenantId} />
          <div className="md:col-span-2">
            <Label>Action</Label>
            <Input name="title" required disabled={isDemoTenant} placeholder="Ex: Produire 2 carrousels expertise" />
          </div>
          <div>
            <Label>Priorité</Label>
            <select name="priority" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm" disabled={isDemoTenant}>
              <option value="high">Prioritaire</option>
              <option value="medium">Important</option>
              <option value="critical">Critique</option>
              <option value="low">Confort</option>
            </select>
          </div>
          <div>
            <Label>Responsable</Label>
            <select name="owner" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm" disabled={isDemoTenant}>
              <option value="jumpstart">JumpStart</option>
              <option value="client">Client</option>
              <option value="shared">Partagé</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <Label>Pourquoi</Label>
            <Textarea name="rationale" rows={3} disabled={isDemoTenant} />
          </div>
          <div>
            <Label>Impact attendu</Label>
            <Input name="expected_impact" disabled={isDemoTenant} placeholder="Ex: Portée +10%" />
          </div>
          <div>
            <Label>Échéance</Label>
            <Input name="due_date" type="date" disabled={isDemoTenant} />
          </div>
          <Button type="submit" disabled={isDemoTenant}>Ajouter au plan</Button>
        </form>
      </Card>
    </div>
  );
}
