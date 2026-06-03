import { Activity, AlertTriangle, Gauge } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PLATFORM_ICONS } from "@/lib/types";
import type { PlatformDiagnosis, PlatformDiagnosisItem } from "@/lib/platform-diagnosis";
import { cn } from "@/lib/utils";

type PlatformDiagnosisCardProps = {
  diagnosis: PlatformDiagnosis;
};

const toneStyles: Record<PlatformDiagnosisItem["tone"], { icon: React.ReactNode; className: string }> = {
  strong: {
    icon: <Gauge className="h-4 w-4" aria-hidden="true" />,
    className: "border-emerald-200 bg-emerald-50/70 text-emerald-700",
  },
  watch: {
    icon: <AlertTriangle className="h-4 w-4" aria-hidden="true" />,
    className: "border-amber-200 bg-amber-50/75 text-amber-700",
  },
  balance: {
    icon: <Activity className="h-4 w-4" aria-hidden="true" />,
    className: "border-indigo-200 bg-indigo-50/70 text-indigo-700",
  },
};

function DiagnosisTile({ item }: { item: PlatformDiagnosisItem }) {
  const style = toneStyles[item.tone];

  return (
    <div className="rounded-xl border border-border/60 bg-white/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{item.label}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">{PLATFORM_ICONS[item.platform]}</span>
            <p className="text-sm font-semibold text-foreground">{item.value}</p>
          </div>
        </div>
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", style.className)}>
          {style.icon}
        </span>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
    </div>
  );
}

export function PlatformDiagnosisCard({ diagnosis }: PlatformDiagnosisCardProps) {
  const items = [diagnosis.primary, diagnosis.watch, diagnosis.balance].filter(Boolean) as PlatformDiagnosisItem[];

  if (items.length === 0) {
    return null;
  }

  return (
    <Card className="card-surface overflow-hidden p-0 fade-in-up">
      <div className="border-b border-border/60 bg-[linear-gradient(135deg,rgba(248,250,252,0.98),rgba(239,246,255,0.85))] p-5">
        <p className="section-label">Diagnostic canaux</p>
        <h2 className="mt-1 section-title">Lecture de l'écosystème</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Synthèse des canaux qui tirent la performance, des risques de lecture et de la concentration du mix.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-3">
        {items.map((item) => (
          <DiagnosisTile key={`${item.label}-${item.platform}`} item={item} />
        ))}
      </div>
    </Card>
  );
}
