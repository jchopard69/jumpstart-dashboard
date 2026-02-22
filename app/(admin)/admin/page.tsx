import type { Metadata } from "next";
import { getSessionProfile, requireAdmin } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Admin - Vue d'ensemble"
};

export default async function AdminOverviewPage() {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const supabase = createSupabaseServiceClient();
  const [{ count: tenantCount }, { count: userCount }, { count: accountCount }] = await Promise.all([
    supabase.from("tenants").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("social_accounts").select("id", { count: "exact", head: true })
  ]);

  const { data: logs } = await supabase
    .from("sync_logs")
    .select("status,started_at")
    .order("started_at", { ascending: false })
    .limit(6);

  return (
    <div className="space-y-8 fade-in">
      <section className="surface-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Console agence</p>
            <h1 className="page-heading">Vue d&apos;ensemble</h1>
            <p className="mt-2 text-sm text-muted-foreground">Suivi temps réel de l&apos;activité Social Pulse.</p>
          </div>
          <Badge variant="secondary">Opérations studio</Badge>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="card-surface p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Clients actifs</p>
            <p className="mt-3 text-3xl font-semibold font-display">{tenantCount ?? 0}</p>
          </Card>
          <Card className="card-surface p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Utilisateurs</p>
            <p className="mt-3 text-3xl font-semibold font-display">{userCount ?? 0}</p>
          </Card>
          <Card className="card-surface p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Comptes connectés</p>
            <p className="mt-3 text-3xl font-semibold font-display">{accountCount ?? 0}</p>
          </Card>
        </div>
      </section>

      <section>
        <Card className="card-surface p-6 fade-in-up">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="section-title">Dernières synchronisations</h2>
              <p className="text-sm text-muted-foreground">État global par tenant.</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {(logs ?? []).map((log, index) => (
              <div key={`${log.started_at}-${index}`} className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3">
                <span className="text-sm text-muted-foreground">{new Date(log.started_at).toLocaleString("fr-FR")}</span>
                <Badge variant={log.status === "success" ? "success" : log.status === "failed" ? "danger" : "warning"}>
                  {log.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

export const dynamic = "force-dynamic";
