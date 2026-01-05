import { getSessionProfile, requireAdmin } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SecurityCheck } from "@/components/admin/security-check";

export default async function AdminHealthPage() {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const supabase = createSupabaseServiceClient();
  const { data: latestLog } = await supabase
    .from("sync_logs")
    .select("status,started_at,finished_at,error_message")
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  const { data: failed } = await supabase
    .from("sync_logs")
    .select("id,tenant_id,platform,started_at,error_message")
    .eq("status", "failed")
    .order("started_at", { ascending: false })
    .limit(5);

  return (
    <div className="space-y-8 fade-in">
      <section className="surface-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Admin agence</p>
            <h1 className="page-heading">Santé</h1>
            <p className="mt-2 text-sm text-muted-foreground">Surveillance des synchronisations et alertes.</p>
          </div>
          <Badge variant="secondary">État système</Badge>
        </div>
      </section>

      <Card className="card-surface p-6 fade-in-up">
        <h2 className="section-title">Statut des crons</h2>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Dernière exécution</p>
            <p className="text-sm">
              {latestLog?.started_at ? new Date(latestLog.started_at).toLocaleString("fr-FR") : "Aucune exécution"}
            </p>
          </div>
          <Badge variant={latestLog?.status === "success" ? "success" : "warning"}>{latestLog?.status ?? "unknown"}</Badge>
        </div>
        {latestLog?.error_message ? (
          <p className="mt-3 text-sm text-destructive">{latestLog.error_message}</p>
        ) : null}
      </Card>

      <Card className="card-surface p-6 fade-in-up">
        <h2 className="section-title">Erreurs récentes</h2>
        <div className="mt-4 space-y-3">
          {(failed ?? []).map((log) => (
            <div key={log.id} className="rounded-2xl border border-border/60 bg-muted/30 p-4">
              <p className="text-sm font-medium">{log.platform}</p>
              <p className="text-xs text-muted-foreground">{new Date(log.started_at).toLocaleString("fr-FR")}</p>
              <p className="text-xs text-muted-foreground">{log.error_message}</p>
            </div>
          ))}
          {!failed?.length ? <p className="text-sm text-muted-foreground">Aucune erreur détectée.</p> : null}
        </div>
      </Card>

      <Card className="card-surface p-6 fade-in-up">
        <h2 className="section-title">Vérification sécurité</h2>
        <p className="text-sm text-muted-foreground">Validation de l&apos;isolation des tenants via les règles RLS.</p>
        <div className="mt-4">
          <SecurityCheck />
        </div>
      </Card>
    </div>
  );
}

export const dynamic = "force-dynamic";
