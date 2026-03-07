"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarEntryForm } from "./calendar-entry-form";
import { AiRecommendations } from "./ai-recommendations";
import { ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type CalendarEntry = {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  platform: string | null;
  planned_date: string | null;
  planned_time: string | null;
  status: "idea" | "draft" | "planned" | "published";
  tags: string[];
  color: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Recommendation = {
  title: string;
  description: string;
  platform: string;
  suggested_day: string;
  suggested_time: string;
  tags: string[];
};

const STATUS_COLORS: Record<string, string> = {
  idea: "bg-gray-400",
  draft: "bg-amber-400",
  planned: "bg-purple-500",
  published: "bg-emerald-500",
};

const STATUS_LABELS: Record<string, string> = {
  idea: "Idee",
  draft: "Brouillon",
  planned: "Planifie",
  published: "Publie",
};

const PLATFORM_ICONS: Record<string, string> = {
  instagram: "IG",
  facebook: "FB",
  linkedin: "LI",
  tiktok: "TK",
  youtube: "YT",
  twitter: "X",
};

const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTH_NAMES = [
  "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre",
];

// ---------------------------------------------------------------------------
// Calendar view component
// ---------------------------------------------------------------------------
export function CalendarView({
  tenantId,
  initialMonth,
}: {
  tenantId: string;
  initialMonth: string;
}) {
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<CalendarEntry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [prefillData, setPrefillData] = useState<Partial<Recommendation> | null>(null);

  const [year, month] = currentMonth.split("-").map(Number);

  // Fetch entries for the current month
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/calendar?tenantId=${tenantId}&month=${currentMonth}`
      );
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch calendar entries:", err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, currentMonth]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Month navigation
  function goToPreviousMonth() {
    const d = new Date(year, month - 2, 1);
    setCurrentMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
    setSelectedDate(null);
  }

  function goToNextMonth() {
    const d = new Date(year, month, 1);
    setCurrentMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
    setSelectedDate(null);
  }

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1);
  // Monday=0 based offset
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;
  const daysInMonth = new Date(year, month, 0).getDate();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);
  // Fill remaining cells to complete the last week
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);

  function dateStr(day: number): string {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function getEntriesForDay(day: number): CalendarEntry[] {
    const ds = dateStr(day);
    return entries.filter((e) => e.planned_date === ds);
  }

  // Entries without a planned date
  const unscheduledEntries = entries.filter((e) => !e.planned_date);

  // Selected day entries
  const selectedDayEntries = selectedDate
    ? entries.filter((e) => e.planned_date === selectedDate)
    : [];

  function handleDayClick(day: number) {
    const ds = dateStr(day);
    setSelectedDate(selectedDate === ds ? null : ds);
  }

  function openNewEntry(date?: string) {
    setEditingEntry(null);
    setPrefillData(date ? { suggested_day: date } : null);
    setShowForm(true);
  }

  function openEditEntry(entry: CalendarEntry) {
    setEditingEntry(entry);
    setPrefillData(null);
    setShowForm(true);
  }

  function handleAddFromRecommendation(rec: Recommendation) {
    setEditingEntry(null);
    setPrefillData(rec);
    setShowAi(false);
    setShowForm(true);
  }

  async function handleSave() {
    setShowForm(false);
    setEditingEntry(null);
    setPrefillData(null);
    await fetchEntries();
  }

  async function handleDelete() {
    setShowForm(false);
    setEditingEntry(null);
    await fetchEntries();
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <section className="card-surface rounded-2xl border border-border/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Month navigation */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goToPreviousMonth} aria-label="Mois precedent">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="min-w-[180px] text-center text-lg font-semibold font-display">
              {MONTH_NAMES[month - 1]} {year}
            </h2>
            <Button variant="outline" size="icon" onClick={goToNextMonth} aria-label="Mois suivant">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAi(true)}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-purple-500" />
              Suggestions IA
            </Button>
            <Button size="sm" onClick={() => openNewEntry(selectedDate ?? undefined)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Ajouter
            </Button>
          </div>
        </div>

        {/* Status legend */}
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={cn("h-2.5 w-2.5 rounded-full", STATUS_COLORS[key])} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Calendar grid + side panel */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Calendar grid */}
        <section className="card-surface rounded-2xl border border-border/60 p-4 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
              Chargement...
            </div>
          ) : (
            <div className="min-w-[500px]">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-px mb-1">
                {DAY_NAMES.map((name) => (
                  <div
                    key={name}
                    className="py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider"
                  >
                    {name}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-px">
                {calendarDays.map((day, idx) => {
                  if (day === null) {
                    return (
                      <div
                        key={`empty-${idx}`}
                        className="min-h-[90px] rounded-lg bg-muted/20"
                      />
                    );
                  }

                  const ds = dateStr(day);
                  const dayEntries = getEntriesForDay(day);
                  const isToday = ds === todayStr;
                  const isSelected = ds === selectedDate;

                  return (
                    <button
                      key={ds}
                      type="button"
                      onClick={() => handleDayClick(day)}
                      className={cn(
                        "min-h-[90px] rounded-lg border p-1.5 text-left transition-colors cursor-pointer",
                        "hover:bg-muted/30",
                        isToday && "border-purple-400 bg-purple-50/50",
                        isSelected && "ring-2 ring-purple-500 border-purple-500",
                        !isToday && !isSelected && "border-border/30 bg-background/50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            "text-xs font-medium tabular-nums",
                            isToday && "rounded-full bg-purple-600 text-white px-1.5 py-0.5"
                          )}
                        >
                          {day}
                        </span>
                        {dayEntries.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{dayEntries.length - 3}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 space-y-0.5">
                        {dayEntries.slice(0, 3).map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center gap-1 group"
                            title={entry.title}
                          >
                            <div
                              className={cn(
                                "h-1.5 w-1.5 shrink-0 rounded-full",
                                entry.color
                                  ? undefined
                                  : STATUS_COLORS[entry.status]
                              )}
                              style={
                                entry.color
                                  ? { backgroundColor: entry.color }
                                  : undefined
                              }
                            />
                            <span className="truncate text-[10px] leading-tight text-foreground/80">
                              {entry.title}
                            </span>
                            {entry.platform && (
                              <span className="shrink-0 text-[8px] font-medium text-muted-foreground/70">
                                {PLATFORM_ICONS[entry.platform] ?? ""}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Side panel */}
        <section className="card-surface rounded-2xl border border-border/60 p-4 space-y-4">
          {selectedDate ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="section-title">
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </h3>
                <Button size="sm" variant="ghost" onClick={() => openNewEntry(selectedDate)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              {selectedDayEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Aucun contenu prevu ce jour.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedDayEntries.map((entry) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      onClick={() => openEditEntry(entry)}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <h3 className="section-title">Apercu</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>{entries.length} entree{entries.length !== 1 ? "s" : ""} ce mois</p>
                {Object.entries(STATUS_LABELS).map(([key, label]) => {
                  const count = entries.filter((e) => e.status === key).length;
                  if (count === 0) return null;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <div className={cn("h-2 w-2 rounded-full", STATUS_COLORS[key])} />
                      <span>
                        {count} {label.toLowerCase()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {unscheduledEntries.length > 0 && (
                <div className="pt-2 border-t border-border/40">
                  <p className="section-label mb-2">Sans date</p>
                  <div className="space-y-1.5">
                    {unscheduledEntries.map((entry) => (
                      <EntryCard
                        key={entry.id}
                        entry={entry}
                        onClick={() => openEditEntry(entry)}
                        compact
                      />
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground pt-2">
                Cliquez sur un jour pour voir les details.
              </p>
            </>
          )}
        </section>
      </div>

      {/* Entry form dialog */}
      <CalendarEntryForm
        open={showForm}
        onOpenChange={setShowForm}
        tenantId={tenantId}
        entry={editingEntry}
        prefill={prefillData}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      {/* AI recommendations panel */}
      <AiRecommendations
        open={showAi}
        onOpenChange={setShowAi}
        tenantId={tenantId}
        month={currentMonth}
        onAddToCalendar={handleAddFromRecommendation}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entry card sub-component
// ---------------------------------------------------------------------------
function EntryCard({
  entry,
  onClick,
  compact,
}: {
  entry: CalendarEntry;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border border-border/40 transition-colors hover:bg-muted/30",
        compact ? "p-2" : "p-3"
      )}
    >
      <div className="flex items-start gap-2">
        <div
          className={cn(
            "mt-1 h-2 w-2 shrink-0 rounded-full",
            entry.color ? undefined : STATUS_COLORS[entry.status]
          )}
          style={entry.color ? { backgroundColor: entry.color } : undefined}
        />
        <div className="flex-1 min-w-0">
          <p className={cn("font-medium truncate", compact ? "text-xs" : "text-sm")}>
            {entry.title}
          </p>
          {!compact && entry.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {entry.description}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {entry.platform && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {PLATFORM_ICONS[entry.platform] ?? entry.platform}
              </Badge>
            )}
            {entry.planned_time && (
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {entry.planned_time.slice(0, 5)}
              </span>
            )}
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0 border-0",
                entry.status === "idea" && "bg-gray-100 text-gray-600",
                entry.status === "draft" && "bg-amber-50 text-amber-700",
                entry.status === "planned" && "bg-purple-50 text-purple-700",
                entry.status === "published" && "bg-emerald-50 text-emerald-700"
              )}
            >
              {STATUS_LABELS[entry.status]}
            </Badge>
          </div>
          {entry.tags && entry.tags.length > 0 && !compact && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {entry.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] bg-muted/50 text-muted-foreground rounded-md px-1.5 py-0.5"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
