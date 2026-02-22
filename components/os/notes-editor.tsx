"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type NotesEditorProps = {
  notes: string | null;
  updatedAt: string | null;
  canEdit: boolean;
  updateNotesAction: (formData: FormData) => Promise<void>;
};

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "à l'instant";
  if (diffMins < 60) return `il y a ${diffMins} min`;
  if (diffHours < 24) return `il y a ${diffHours}h`;
  if (diffDays === 1) return "hier";
  return `il y a ${diffDays} jours`;
}

export function NotesEditor({ notes, updatedAt, canEdit, updateNotesAction }: NotesEditorProps) {
  return (
    <Card className="card-surface p-6 fade-in-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
          <h2 className="section-title">Carnet de bord</h2>
        </div>
        {updatedAt && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Mis à jour {formatRelativeTime(updatedAt)}
          </span>
        )}
      </div>
      <form action={updateNotesAction} className="mt-4 space-y-3">
        <Textarea
          name="notes"
          rows={8}
          placeholder="Décisions, retours client, points bloquants..."
          defaultValue={notes ?? ""}
          className="resize-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300"
        />
        <Button type="submit" className="w-full" disabled={!canEdit}>
          <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Enregistrer
        </Button>
      </form>
    </Card>
  );
}
