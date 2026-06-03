"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toaster";
import { ReportScheduleForm } from "./report-schedule-form";
import { Plus, Mail, Calendar, Clock, Trash2, Pencil } from "lucide-react";

type Schedule = {
  id: string;
  tenant_id: string;
  frequency: "weekly" | "monthly";
  recipients: string[];
  is_active: boolean;
  last_sent_at: string | null;
  next_send_at: string | null;
  created_at: string;
};

type ReportScheduleListProps = {
  initialSchedules: Schedule[];
  tenantId: string;
  isDemoTenant: boolean;
  canManage: boolean;
};

const FREQ_LABELS: Record<string, string> = {
  weekly: "Hebdomadaire",
  monthly: "Mensuel",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReportScheduleList({
  initialSchedules,
  tenantId,
  isDemoTenant,
  canManage,
}: ReportScheduleListProps) {
  const [schedules, setSchedules] = useState<Schedule[]>(initialSchedules);
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();
  const activeCount = schedules.filter((schedule) => schedule.is_active).length;
  const nextActiveSend = schedules
    .filter((schedule) => schedule.is_active && schedule.next_send_at)
    .sort((a, b) => String(a.next_send_at).localeCompare(String(b.next_send_at)))[0]?.next_send_at ?? null;

  async function toggleActive(schedule: Schedule) {
    if (!canManage) return;
    setTogglingId(schedule.id);
    try {
      const res = await fetch("/api/reports/schedules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: schedule.id,
          tenantId,
          is_active: !schedule.is_active,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSchedules((prev) =>
          prev.map((s) => (s.id === schedule.id ? data.schedule : s))
        );
        toast.success(
          schedule.is_active ? "Rapport desactive" : "Rapport active"
        );
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.message ?? "Erreur");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!canManage) return;
    if (!confirm("Supprimer ce rapport automatique ?")) return;
    setDeletingId(id);
    try {
      const res = await fetch("/api/reports/schedules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, tenantId }),
      });

      if (res.ok) {
        setSchedules((prev) => prev.filter((s) => s.id !== id));
        toast.success("Rapport supprime");
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.message ?? "Erreur");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setDeletingId(null);
    }
  }

  function handleSaved() {
    setShowForm(false);
    setEditingSchedule(null);
    router.refresh();
    // Re-fetch
    fetch(`/api/reports/schedules?tenantId=${tenantId}`)
      .then((res) => res.json())
      .then((data) => setSchedules(data.schedules ?? []))
      .catch(() => {});
  }

  if (schedules.length === 0 && !showForm) {
    return (
      <section className="surface-panel p-8 sm:p-12">
        <div className="mx-auto max-w-2xl text-center space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10">
            <Mail className="h-8 w-8 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">
              Aucun envoi automatique configuré
            </h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Ajoutez un rythme d'envoi pour transformer le dashboard en rituel client : score, contenus phares,
              qualité des données et plan d'actions arrivent directement par email.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
            <div className="rounded-xl border border-border/60 p-4">
              <p className="text-sm font-medium">1. Destinataires</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Ajoutez l'équipe client et les décideurs.</p>
            </div>
            <div className="rounded-xl border border-border/60 p-4">
              <p className="text-sm font-medium">2. Fréquence</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Choisissez hebdomadaire ou mensuel.</p>
            </div>
            <div className="rounded-xl border border-border/60 p-4">
              <p className="text-sm font-medium">3. Suivi</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Le prochain envoi est suivi automatiquement.</p>
            </div>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            disabled={isDemoTenant || !canManage}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Configurer un rapport
          </Button>
          {isDemoTenant && (
            <p className="text-xs text-muted-foreground">
              Configuration désactivée en mode démo.
            </p>
          )}
          {!isDemoTenant && !canManage && (
            <p className="text-xs text-muted-foreground">
              Seuls les managers client peuvent modifier les rapports automatiques.
            </p>
          )}
        </div>

        <ReportScheduleForm
          open={showForm}
          onOpenChange={setShowForm}
          tenantId={tenantId}
          schedule={null}
          onSaved={handleSaved}
          canManage={canManage}
          isDemoTenant={isDemoTenant}
        />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="surface-panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="section-label">Planification</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {schedules.length} rapport{schedules.length > 1 ? "s" : ""} configuré{schedules.length > 1 ? "s" : ""} · {activeCount} actif{activeCount > 1 ? "s" : ""}
            {nextActiveSend ? ` · prochain envoi ${formatDate(nextActiveSend)}` : ""}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditingSchedule(null);
            setShowForm(true);
          }}
          disabled={isDemoTenant || !canManage}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Ajouter
        </Button>
      </div>

      {schedules.map((schedule) => (
        <Card key={schedule.id} className="card-surface p-5 fade-in-up">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant={schedule.is_active ? "default" : "secondary"}
                  className="text-xs"
                >
                  {schedule.is_active ? "Actif" : "Inactif"}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {FREQ_LABELS[schedule.frequency] ?? schedule.frequency}
                </Badge>
              </div>

              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {schedule.recipients.join(", ")}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Dernier envoi: {formatDate(schedule.last_sent_at)}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Prochain: {formatDate(schedule.next_send_at)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleActive(schedule)}
                disabled={togglingId === schedule.id || isDemoTenant || !canManage}
                aria-label={`${schedule.is_active ? "Désactiver" : "Activer"} le rapport ${FREQ_LABELS[schedule.frequency] ?? schedule.frequency}`}
              >
                {schedule.is_active ? "Désactiver" : "Activer"}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditingSchedule(schedule);
                  setShowForm(true);
                }}
                disabled={isDemoTenant || !canManage}
                aria-label={`Modifier le rapport ${FREQ_LABELS[schedule.frequency] ?? schedule.frequency}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(schedule.id)}
                disabled={deletingId === schedule.id || isDemoTenant || !canManage}
                className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                aria-label={`Supprimer le rapport ${FREQ_LABELS[schedule.frequency] ?? schedule.frequency}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      ))}

      <ReportScheduleForm
        open={showForm}
        onOpenChange={setShowForm}
        tenantId={tenantId}
        schedule={editingSchedule}
        onSaved={handleSaved}
        canManage={canManage}
        isDemoTenant={isDemoTenant}
      />
    </section>
  );
}
