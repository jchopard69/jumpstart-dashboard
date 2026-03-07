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
import { X, Plus } from "lucide-react";

type Schedule = {
  id: string;
  frequency: "weekly" | "monthly";
  recipients: string[];
  is_active: boolean;
};

type ReportScheduleFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  schedule: Schedule | null;
  onSaved: () => void;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ReportScheduleForm({
  open,
  onOpenChange,
  tenantId,
  schedule,
  onSaved,
}: ReportScheduleFormProps) {
  const isEditing = !!schedule;

  const [frequency, setFrequency] = useState<"weekly" | "monthly">(
    schedule?.frequency ?? "weekly"
  );
  const [recipients, setRecipients] = useState<string[]>(
    schedule?.recipients ?? []
  );
  const [emailInput, setEmailInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addRecipient() {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;

    if (!EMAIL_REGEX.test(email)) {
      setError("Adresse email invalide.");
      return;
    }

    if (recipients.includes(email)) {
      setError("Cette adresse est deja ajoutee.");
      return;
    }

    setRecipients([...recipients, email]);
    setEmailInput("");
    setError(null);
  }

  function removeRecipient(email: string) {
    setRecipients(recipients.filter((r) => r !== email));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addRecipient();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (recipients.length === 0) {
      setError("Ajoutez au moins un destinataire.");
      return;
    }

    setSaving(true);
    setError(null);

    const body: Record<string, unknown> = {
      tenantId,
      frequency,
      recipients,
    };

    if (isEditing && schedule) {
      body.id = schedule.id;
    }

    try {
      const res = await fetch("/api/reports/schedules", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message ?? "Erreur lors de l'enregistrement.");
        return;
      }

      onSaved();
    } catch {
      setError("Erreur reseau.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifier le rapport" : "Nouveau rapport automatique"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Frequency */}
          <div>
            <label className="section-label mb-1.5 block">Frequence</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFrequency("weekly")}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                  frequency === "weekly"
                    ? "border-purple-500 bg-purple-50 text-purple-700"
                    : "border-border/60 text-muted-foreground hover:bg-muted/30"
                }`}
              >
                Hebdomadaire
                <p className="text-[10px] font-normal mt-0.5">
                  Chaque lundi a 8h
                </p>
              </button>
              <button
                type="button"
                onClick={() => setFrequency("monthly")}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                  frequency === "monthly"
                    ? "border-purple-500 bg-purple-50 text-purple-700"
                    : "border-border/60 text-muted-foreground hover:bg-muted/30"
                }`}
              >
                Mensuel
                <p className="text-[10px] font-normal mt-0.5">
                  Le 1er du mois a 8h
                </p>
              </button>
            </div>
          </div>

          {/* Recipients */}
          <div>
            <label className="section-label mb-1.5 block">Destinataires</label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value);
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="email@exemple.com"
                className="flex-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={addRecipient}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {recipients.map((email) => (
                  <Badge
                    key={email}
                    variant="secondary"
                    className="text-xs gap-1 pr-1"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeRecipient(email)}
                      className="rounded-full p-0.5 hover:bg-muted"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && <p className="text-sm text-rose-600">{error}</p>}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving
                ? "Enregistrement..."
                : isEditing
                ? "Mettre a jour"
                : "Creer le rapport"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
