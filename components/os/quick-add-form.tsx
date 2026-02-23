"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const KIND_LABELS: Record<string, string> = {
  idea: "Idées",
  shoot: "Tournage",
  edit: "Montage",
  publish: "Publication",
  next_step: "Next steps",
  monthly_priority: "Priorités du mois suivant"
};

type QuickAddFormProps = {
  canEdit: boolean;
  allowedKinds?: string[];
  createItemAction: (formData: FormData) => Promise<void>;
};

export function QuickAddForm({ canEdit, allowedKinds, createItemAction }: QuickAddFormProps) {
  const filteredKinds = allowedKinds?.length
    ? Object.entries(KIND_LABELS).filter(([kind]) => allowedKinds.includes(kind))
    : Object.entries(KIND_LABELS);
  const defaultKind = filteredKinds[0]?.[0] ?? "idea";

  return (
    <Card className="card-surface p-6 fade-in-up">
      <div className="flex items-center gap-2">
        <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        <h2 className="section-title">Quick add</h2>
      </div>
      <p className="text-sm text-muted-foreground mt-1">Ajoute une action ou une idée.</p>
      <form action={createItemAction} className="mt-4 space-y-3">
        <Input name="title" placeholder="Titre" required />
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Type</label>
          <select
            name="kind"
            defaultValue={defaultKind}
            className="h-10 w-full rounded-xl border border-input bg-background/90 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300"
            disabled={!canEdit || filteredKinds.length <= 1}
          >
            {filteredKinds.map(([kind, label]) => (
              <option key={kind} value={kind}>
                {label}
              </option>
            ))}
          </select>
          {!canEdit && (
            <p className="text-xs text-muted-foreground">Seules certaines actions sont disponibles selon votre rôle.</p>
          )}
        </div>
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Priorité</label>
          <select
            name="priority"
            defaultValue="medium"
            className="h-10 w-full rounded-xl border border-input bg-background/90 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <Input name="owner" placeholder="Owner / responsable" />
        <Input name="due_date" type="date" />
        <Textarea name="description" placeholder="Détails" rows={3} />
        <Button type="submit" className="w-full" disabled={!canEdit}>
          <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Ajouter
        </Button>
      </form>
    </Card>
  );
}
