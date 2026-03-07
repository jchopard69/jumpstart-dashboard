"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CalendarEntry, Recommendation } from "./calendar-view";

type CalendarEntryFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  entry: CalendarEntry | null;
  prefill: Partial<Recommendation> | null;
  onSave: () => void;
  onDelete: () => void;
};

const PLATFORMS = [
  { value: "", label: "Toutes" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "twitter", label: "X (Twitter)" },
];

const STATUSES = [
  { value: "idea", label: "Idee" },
  { value: "draft", label: "Brouillon" },
  { value: "planned", label: "Planifie" },
  { value: "published", label: "Publie" },
];

const COLOR_SWATCHES = [
  "#7c3aed",
  "#a855f7",
  "#ec4899",
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
];

export function CalendarEntryForm({
  open,
  onOpenChange,
  tenantId,
  entry,
  prefill,
  onSave,
  onDelete,
}: CalendarEntryFormProps) {
  const isEditing = !!entry;
  const initial = entry ?? {
    title: prefill?.title ?? "",
    description: prefill?.description ?? "",
    platform: prefill?.platform ?? "",
    planned_date: prefill?.suggested_day ?? "",
    planned_time: prefill?.suggested_time ?? "",
    status: "idea" as const,
    tags: prefill?.tags ?? [],
    color: null as string | null,
  };

  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? "");
  const [platform, setPlatform] = useState(initial.platform ?? "");
  const [plannedDate, setPlannedDate] = useState(initial.planned_date ?? "");
  const [plannedTime, setPlannedTime] = useState(initial.planned_time ?? "");
  const [status, setStatus] = useState(initial.status);
  const [tagsInput, setTagsInput] = useState((initial.tags ?? []).join(", "));
  const [color, setColor] = useState<string | null>(initial.color);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when entry/prefill changes
  const resetKey = entry?.id ?? prefill?.title ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Le titre est requis.");
      return;
    }

    setSaving(true);
    setError(null);

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const body: Record<string, unknown> = {
      tenantId,
      title: title.trim(),
      description: description.trim() || null,
      platform: platform || null,
      planned_date: plannedDate || null,
      planned_time: plannedTime || null,
      status,
      tags,
      color,
    };

    if (isEditing && entry) {
      body.id = entry.id;
    }

    try {
      const res = await fetch("/api/calendar", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message ?? "Erreur lors de l'enregistrement.");
        return;
      }

      onSave();
    } catch {
      setError("Erreur reseau.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!entry) return;
    setDeleting(true);

    try {
      const res = await fetch("/api/calendar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, tenantId }),
      });

      if (res.ok) {
        onDelete();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.message ?? "Erreur lors de la suppression.");
      }
    } catch {
      setError("Erreur reseau.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifier l'entree" : "Nouvelle entree"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" key={resetKey}>
          {/* Title */}
          <div>
            <label className="section-label mb-1 block">Titre *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre du contenu"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="section-label mb-1 block">Description</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description ou notes..."
            />
          </div>

          {/* Platform + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="section-label mb-1 block">Plateforme</label>
              <select
                className="flex h-9 w-full rounded-xl border border-border/60 bg-background px-3 text-sm"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="section-label mb-1 block">Statut</label>
              <select
                className="flex h-9 w-full rounded-xl border border-border/60 bg-background px-3 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as CalendarEntry["status"])}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="section-label mb-1 block">Date prevue</label>
              <Input
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
              />
            </div>
            <div>
              <label className="section-label mb-1 block">Heure prevue</label>
              <Input
                type="time"
                value={plannedTime}
                onChange={(e) => setPlannedTime(e.target.value)}
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="section-label mb-1 block">Tags</label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="tag1, tag2, tag3"
            />
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Separes par des virgules
            </p>
          </div>

          {/* Color */}
          <div>
            <label className="section-label mb-1.5 block">Couleur</label>
            <div className="flex items-center gap-2">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(color === c ? null : c)}
                  className={cn(
                    "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                    color === c ? "border-foreground scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
              {color && (
                <button
                  type="button"
                  onClick={() => setColor(null)}
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Aucune
                </button>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-rose-600">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {isEditing && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                >
                  {deleting ? "Suppression..." : "Supprimer"}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Enregistrement..." : isEditing ? "Mettre a jour" : "Creer"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
