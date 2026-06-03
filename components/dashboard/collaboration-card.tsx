import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CollaborationData, UpcomingShoot, DocumentData } from "@/lib/types/dashboard";
import { buildProductionReadiness } from "@/lib/production-readiness";

type CollaborationCardProps = {
  collaboration: CollaborationData | null;
  shoots: UpcomingShoot[];
  documents: DocumentData[];
  tenantId?: string;
};

export function CollaborationCard({ collaboration, shoots, documents, tenantId }: CollaborationCardProps) {
  const shootDays = collaboration?.shoot_days_remaining ?? 0;
  const readiness = buildProductionReadiness({
    shootDaysRemaining: shootDays,
    shoots,
    documents,
  });
  const collaborationHref = tenantId
    ? `/client/collaboration?tenantId=${encodeURIComponent(tenantId)}`
    : "/client/collaboration";

  return (
    <Card className="card-surface overflow-hidden p-0 fade-in-up">
      <div className="border-b border-border/60 bg-[linear-gradient(135deg,hsl(var(--primary)/0.10),hsl(var(--secondary)/0.12),transparent)] p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/15 bg-primary/5">
            <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            </svg>
          </div>
          <div>
            <p className="section-label text-primary">Studio & Production</p>
            <h2 className="section-title">Continuité créative</h2>
          </div>
        </div>
        <Link
          href={collaborationHref}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-xs")}
        >
          Voir tout
        </Link>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{readiness.summary}</p>
      </div>

      <div className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-background/80 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Statut</p>
            <p className={cn(
              "mt-2 text-sm font-semibold",
              readiness.status === "ready" ? "text-emerald-600" : readiness.status === "watch" ? "text-amber-600" : "text-muted-foreground"
            )}>
              {readiness.statusLabel}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/80 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Shooting</p>
            <p className="mt-2 text-lg font-semibold tabular-nums font-display">{readiness.shootDaysRemaining}</p>
            <p className="text-[11px] text-muted-foreground">jours restants</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/80 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Ressources</p>
            <p className="mt-2 text-lg font-semibold tabular-nums font-display">{readiness.documentCount}</p>
            <p className="text-[11px] text-muted-foreground">documents</p>
          </div>
        </div>

        <div>
          <p className="section-label mb-2">Prochain jalon</p>
          {shoots.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 p-3">
              <p className="text-xs text-muted-foreground">Aucun shooting planifié.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {shoots.slice(0, 2).map((shoot) => {
                const shootDate = new Date(shoot.shoot_date);
                const now = new Date();
                const diffDays = Math.ceil((shootDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                const isUrgent = diffDays >= 0 && diffDays <= 7;
                const countdownLabel = diffDays === 0 ? "Aujourd'hui"
                  : diffDays === 1 ? "Demain"
                  : diffDays < 0 ? `Il y a ${Math.abs(diffDays)} jour${Math.abs(diffDays) > 1 ? "s" : ""}`
                  : `Dans ${diffDays} jour${diffDays > 1 ? "s" : ""}`;

                return (
                  <div key={shoot.id} className={cn(
                    "rounded-lg border p-3 transition-colors hover:bg-muted/20",
                    isUrgent ? "border-amber-200 bg-amber-50/30" : "border-border/50"
                  )}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium tabular-nums">
                        {shootDate.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                      </p>
                      <span className={cn(
                        "text-[10px] font-medium rounded-full px-2 py-0.5",
                        diffDays <= 0 ? "bg-rose-100 text-rose-700"
                          : isUrgent ? "bg-amber-100 text-amber-700"
                          : "bg-muted/60 text-muted-foreground"
                      )}>
                        {countdownLabel}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{shoot.location ?? "Lieu à définir"}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {readiness.featuredDocuments.length > 0 && (
          <div>
            <p className="section-label mb-2">Ressources clés</p>
            <ul className="space-y-1.5">
              {readiness.featuredDocuments.map((doc) => (
                <li key={`${doc.name}-${doc.tag}`} className="flex items-center justify-between rounded-lg p-2 text-sm transition-colors hover:bg-muted/20">
                  <span className="truncate mr-2">{doc.name}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">{doc.tag}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
