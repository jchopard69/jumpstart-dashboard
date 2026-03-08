import type { Metadata } from "next";
import { getSessionProfile, requireAdmin } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SecurityCheck } from "@/components/admin/security-check";
import { TenantSyncButton } from "@/components/admin/tenant-sync-button";

export const metadata: Metadata = {
  title: "Admin - Santé"
};

function formatRelative(dateIso: string | null | undefined) {
  if (!dateIso) return "jamais";
  const then = new Date(dateIso);
  if (Number.isNaN(then.getTime())) return "";
  const diffMs = Date.now() - then.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 2) return "à l’instant";
  if (mins < 60) return `il y a ${mins} min`;
  if (hours < 24) return `il y a ${hours}h`;
  return `il y a ${days}j`;
}

function getStatusBadge(status: string | null) {
  switch (status) {
    case "success":
      return <Badge variant="success">OK</Badge>;
    case "failed":
      return <Badge variant="danger">Échec</Badge>;
    case "running":
      return <Badge variant="warning">En cours</Badge>;
    default:
      return <Badge variant="secondary">—</Badge>;
  }
}

export default async function AdminHealthPage() {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const supabase = createSupabaseServiceClient();

  const [{ data: latestLog }, { data: failed }, { data: tenants }, { data: accountsNeedingAction }, { data: recentNotifications }] = await Promise.all([
    supabase
      .from("sync_logs")
      .select("status,started_at,finished_at,error_message")
      .order("started_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("sync_logs")
      .select("id,tenant_id,platform,started_at,error_message")
      .eq("status", "failed")
      .order("started_at", { ascending: false })
      .limit(8),
    supabase
      .from("tenants")
      .select("id,name,slug,is_active")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("social_accounts")
      .select("id,tenant_id,platform,account_name,auth_status,last_error,last_sync_at")
      .in("auth_status", ["expired", "revoked"])
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("notifications")
      .select("id,tenant_id,type,title,is_read,created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const tenantNameById = new Map<string, string>();
  for (const t of tenants ?? []) {
    tenantNameById.set(t.id, t.name);
  }

  // Last sync per tenant (best-effort): take the most recent sync_log entry for each tenant
  const { data: recentSyncLogs } = await supabase
    .from("sync_logs")
    .select("tenant_id,status,started_at,finished_at")
    .order("started_at", { ascending: false })
    .limit(400);

  const lastSyncByTenant = new Map<string, { status: string; finished_at: string | null; started_at: string }>();
  for (const log of recentSyncLogs ?? []) {
    if (!log.tenant_id) continue;
    if (lastSyncByTenant.has(log.tenant_id)) continue;
    lastSyncByTenant.set(log.tenant_id, {
      status: String(log.status ?? ""),
      finished_at: (log.finished_at as string | null) ?? null,
      started_at: String(log.started_at ?? ""),
    });
  }

  // Unread notifications per tenant
  const unreadByTenant = new Map<string, number>();
  for (const n of recentNotifications ?? []) {
    if (!n.tenant_id) continue;
    if (n.is_read) continue;
    unreadByTenant.set(String(n.tenant_id), (unreadByTenant.get(String(n.tenant_id)) ?? 0) + 1);
  }

  const actionAccountsByTenant = new Map<string, number>();
  for (const acc of accountsNeedingAction ?? []) {
    if (!acc.tenant_id) continue;
    const id = String(acc.tenant_id);
    actionAccountsByTenant.set(id, (actionAccountsByTenant.get(id) ?? 0) + 1);
  }

  const tenantRows = (tenants ?? []).map((t) => {
    const lastSync = lastSyncByTenant.get(t.id);
    const unread = unreadByTenant.get(t.id) ?? 0;
    const actionAccounts = actionAccountsByTenant.get(t.id) ?? 0;
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      lastSync,
      unread,
      actionAccounts,
    };
  });

  const needsAttention = tenantRows
    .filter((row) => (row.unread > 0 || row.actionAccounts > 0 || row.lastSync?.status === "failed"))
    .sort((a, b) => (b.unread + b.actionAccounts) - (a.unread + a.actionAccounts));

  return (
    <div className="space-y-8 fade-in">
      <section className="surface-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="section-label">Admin agence</p>
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
              {latestLog?.finished_at ? (
                <span className="text-xs text-muted-foreground"> · terminé {formatRelative(latestLog.finished_at)}</span>
              ) : null}
            </p>
          </div>
          {getStatusBadge(latestLog?.status ?? null)}
        </div>
        {latestLog?.error_message ? (
          <p className="mt-3 text-sm text-destructive">{latestLog.error_message}</p>
        ) : null}
      </Card>

      <Card className="card-surface p-6 fade-in-up">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="section-title">Tenants à surveiller</h2>
            <p className="text-sm text-muted-foreground">Connexions expirées, notifs non lues, derniers échecs.</p>
          </div>
          <Badge variant={needsAttention.length > 0 ? "warning" : "success"}>
            {needsAttention.length > 0 ? `${needsAttention.length} attention` : "Tout OK"}
          </Badge>
        </div>

        <div className="mt-5 space-y-3">
          {(needsAttention.length ? needsAttention : tenantRows.slice(0, 10)).map((row) => (
            <div key={row.id} className="rounded-2xl border border-border/60 bg-white/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{row.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    Dernière sync: {row.lastSync?.finished_at ? formatRelative(row.lastSync.finished_at) : "—"}
                    {row.lastSync?.status ? ` · ${row.lastSync.status}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {row.actionAccounts > 0 && (
                    <Badge variant="warning">{row.actionAccounts} compte(s) à reconnecter</Badge>
                  )}
                  {row.unread > 0 && (
                    <Badge variant="secondary">{row.unread} notif.</Badge>
                  )}
                  {row.lastSync?.status === "failed" && <Badge variant="danger">Sync KO</Badge>}
                  <TenantSyncButton tenantId={row.id} />
                  <a href={`/admin/clients/${row.id}`}>
                    <Button size="sm" variant="outline" className="h-8 text-xs">Ouvrir</Button>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="card-surface p-6 fade-in-up">
        <h2 className="section-title">Erreurs récentes (logs)</h2>
        <div className="mt-4 space-y-3">
          {(failed ?? []).map((log) => (
            <div key={log.id} className="rounded-2xl border border-border/60 bg-muted/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {tenantNameById.get(String(log.tenant_id)) ?? String(log.tenant_id).slice(0, 8)} · {log.platform}
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(log.started_at).toLocaleString("fr-FR")}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{log.error_message}</p>
                </div>
                <a href={`/admin/clients/${log.tenant_id}`}>
                  <Button size="sm" variant="outline" className="h-8 text-xs">Client</Button>
                </a>
              </div>
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
