import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CollaborationData, UpcomingShoot, DocumentData } from "@/lib/types/dashboard";

type CollaborationCardProps = {
  collaboration: CollaborationData | null;
  shoots: UpcomingShoot[];
  documents: DocumentData[];
};

export function CollaborationCard({ collaboration, shoots, documents }: CollaborationCardProps) {
  const shootDays = collaboration?.shoot_days_remaining ?? 0;

  return (
    <Card className="card-surface p-6 fade-in-up">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
            <svg className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            </svg>
          </div>
          <h2 className="section-title">Studio & Production</h2>
        </div>
        <Link
          href="/client/os"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-xs")}
        >
          Voir tout
        </Link>
      </div>

      <div className="space-y-4">
        {/* Shoot days remaining */}
        <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-3.5">
          <p className="text-sm text-muted-foreground">Jours de shooting</p>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-xl font-bold font-display tabular-nums",
              shootDays === 0 ? "text-rose-500" : shootDays <= 2 ? "text-amber-500" : "text-foreground"
            )}>
              {shootDays}
            </span>
            <span className="text-xs text-muted-foreground">restants</span>
          </div>
        </div>

        {/* Upcoming shoots */}
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium mb-2">Shootings à venir</p>
          {shoots.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 italic">Aucun shooting planifié.</p>
          ) : (
            <div className="space-y-2">
              {shoots.slice(0, 3).map((shoot) => (
                <div key={shoot.id} className="rounded-lg border border-border/50 p-3 transition-colors hover:bg-muted/20">
                  <p className="text-sm font-medium tabular-nums">
                    {new Date(shoot.shoot_date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{shoot.location ?? "Lieu à définir"}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Documents */}
        {documents.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-medium mb-2">Documents</p>
            <ul className="space-y-1.5">
              {documents.slice(0, 4).map((doc) => (
                <li key={doc.id} className="flex items-center justify-between rounded-lg p-2 text-sm transition-colors hover:bg-muted/20">
                  <span className="truncate mr-2">{doc.file_name}</span>
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
