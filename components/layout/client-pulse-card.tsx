import Link from "next/link";
import { Activity, AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClientPulse } from "@/lib/client-pulse-core";

type ClientPulseCardProps = {
  pulse: ClientPulse | null;
  tenantId?: string | null;
};

const statusConfig: Record<ClientPulse["status"], { label: string; icon: React.ReactNode; className: string }> = {
  healthy: {
    label: "OK",
    icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  watch: {
    label: "À suivre",
    icon: <Activity className="h-3.5 w-3.5" aria-hidden="true" />,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  attention: {
    label: "Priorité",
    icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />,
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

function withTenant(href: ClientPulse["nextHref"], tenantId?: string | null) {
  return tenantId ? `${href}?tenantId=${encodeURIComponent(tenantId)}` : href;
}

function formatSyncAge(dateIso?: string | null) {
  if (!dateIso) return "Jamais";
  const date = new Date(dateIso);
  if (!Number.isFinite(date.getTime())) return "Inconnue";
  const hours = Math.floor((Date.now() - date.getTime()) / (60 * 60 * 1000));
  if (hours < 1) return "< 1h";
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}j`;
}

export function ClientPulseCard({ pulse, tenantId }: ClientPulseCardProps) {
  if (!pulse) return null;
  const status = statusConfig[pulse.status];

  return (
    <section className="mt-5 rounded-2xl border border-border/60 bg-white/70 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-center justify-between gap-3">
        <p className="section-label">Pulse client</p>
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]", status.className)}>
          {status.icon}
          {status.label}
        </span>
      </div>

      <div className="mt-3">
        <p className="text-sm font-semibold leading-snug text-foreground">{pulse.headline}</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-border/50 bg-muted/25 p-2">
            <p className="text-[10px] text-muted-foreground">Score</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">
              {pulse.score != null ? pulse.score : "-"}
              {pulse.grade ? <span className="ml-1 text-[10px] text-muted-foreground">{pulse.grade}</span> : null}
            </p>
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/25 p-2">
            <p className="text-[10px] text-muted-foreground">Alertes</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">{pulse.unreadNotifications}</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/25 p-2">
            <p className="text-[10px] text-muted-foreground">Sync</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">{formatSyncAge(pulse.lastSyncAt)}</p>
          </div>
        </div>
      </div>

      <Link
        href={withTenant(pulse.nextHref, tenantId)}
        className="mt-3 inline-flex w-full items-center justify-between rounded-xl border border-primary/15 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
      >
        {pulse.nextLabel}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </section>
  );
}
