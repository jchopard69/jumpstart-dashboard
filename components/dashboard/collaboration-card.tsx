import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyShoots } from "@/components/ui/empty-state";
import type { CollaborationData, UpcomingShoot, DocumentData } from "@/lib/types/dashboard";

type CollaborationCardProps = {
  collaboration: CollaborationData | null;
  shoots: UpcomingShoot[];
  documents: DocumentData[];
};

export function CollaborationCard({ collaboration, shoots, documents }: CollaborationCardProps) {
  return (
    <Card className="card-surface p-6 fade-in-up">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Collaboration</h2>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/client/os">Voir tout</Link>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">Suivi de production & prochains shootings.</p>
      <div className="mt-4 space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
          <p className="text-sm">Jours de shooting restants</p>
          <Badge variant="secondary" className="text-lg font-semibold">
            {collaboration?.shoot_days_remaining ?? 0}
          </Badge>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Shootings à venir</p>
          <div className="mt-2 space-y-2">
            {shoots.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Aucun shooting planifié.</p>
            ) : (
              shoots.slice(0, 3).map((shoot) => (
                <div key={shoot.id} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-medium">{new Date(shoot.shoot_date).toLocaleDateString("fr-FR")}</p>
                  <p className="text-xs text-muted-foreground">{shoot.location ?? "Lieu à définir"}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {documents.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Documents partagés</p>
            <ul className="mt-2 space-y-2">
              {documents.slice(0, 4).map((doc) => (
                <li key={doc.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{doc.file_name}</span>
                  <Badge variant="outline">{doc.tag}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
