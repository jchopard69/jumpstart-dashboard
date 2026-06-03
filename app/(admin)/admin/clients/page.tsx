import type { Metadata } from "next";
import { getSessionProfile, requireAdmin } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTenant, deactivateTenant } from "@/app/(admin)/admin/actions";
import { ClientsList, type ClientRow } from "@/components/admin/clients-list";
import { computeAdminClientHealth } from "@/lib/admin-client-health";
import type { Platform, SyncStatus } from "@/lib/types";

export const metadata: Metadata = {
  title: "Admin - Clients"
};

export default async function AdminClientsPage() {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const supabase = createSupabaseServiceClient();

  const [{ data: tenants }, { data: accounts }, { data: syncLogs }] = await Promise.all([
    supabase.from("tenants").select("id,name,slug,is_active,created_at").order("name"),
    supabase.from("social_accounts").select("tenant_id,platform"),
    supabase
      .from("sync_logs")
      .select("tenant_id,status,started_at")
      .order("started_at", { ascending: false }),
  ]);

  // Build platform set per tenant
  const platformsByTenant = new Map<string, Set<Platform>>();
  for (const acc of accounts ?? []) {
    if (!platformsByTenant.has(acc.tenant_id)) {
      platformsByTenant.set(acc.tenant_id, new Set());
    }
    platformsByTenant.get(acc.tenant_id)!.add(acc.platform as Platform);
  }

  // Build last sync per tenant
  const lastSyncByTenant = new Map<string, { status: SyncStatus; started_at: string }>();
  for (const log of syncLogs ?? []) {
    if (!lastSyncByTenant.has(log.tenant_id)) {
      lastSyncByTenant.set(log.tenant_id, {
        status: log.status as SyncStatus,
        started_at: log.started_at,
      });
    }
  }

  const clientRows: ClientRow[] = (tenants ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    is_active: t.is_active,
    platforms: Array.from(platformsByTenant.get(t.id) ?? []),
    lastSyncStatus: lastSyncByTenant.get(t.id)?.status ?? null,
    lastSyncAt: lastSyncByTenant.get(t.id)?.started_at ?? null,
    health: computeAdminClientHealth({
      isActive: t.is_active,
      platforms: Array.from(platformsByTenant.get(t.id) ?? []),
      lastSyncStatus: lastSyncByTenant.get(t.id)?.status ?? null,
      lastSyncAt: lastSyncByTenant.get(t.id)?.started_at ?? null,
    }),
  }));
  const activeClients = clientRows.filter((client) => client.is_active);
  const riskClients = clientRows.filter((client) => client.health.status === "risk").length;
  const watchClients = clientRows.filter((client) => client.health.status === "watch").length;
  const healthyClients = clientRows.filter((client) => client.health.status === "healthy").length;
  const averageHealth = activeClients.length
    ? Math.round(activeClients.reduce((sum, client) => sum + client.health.score, 0) / activeClients.length)
    : 0;

  return (
    <div className="space-y-8 fade-in">
      <section className="surface-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="section-label">Admin agence</p>
            <h1 className="page-heading">Clients</h1>
            <p className="mt-2 text-sm text-muted-foreground">Pilotez les espaces clients et leurs accès.</p>
          </div>
          <Badge variant="secondary">
            {(tenants ?? []).filter((t) => t.is_active).length} actif{(tenants ?? []).filter((t) => t.is_active).length > 1 ? "s" : ""}
          </Badge>
        </div>
        <form action={createTenant} className="mt-6 grid gap-4 md:grid-cols-[1.4fr_1fr_auto]">
          <Input name="name" placeholder="Nom du client" required />
          <Input name="slug" placeholder="client-slug" required />
          <Button type="submit">Créer</Button>
        </form>
      </section>

      <section className="card-surface rounded-2xl p-6 fade-in-up">
        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-border/60 bg-muted/25 p-4">
            <p className="section-label">Santé moyenne</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{averageHealth}%</p>
          </div>
          <div className="rounded-xl border border-rose-200/70 bg-rose-50/70 p-4">
            <p className="section-label text-rose-700">À traiter</p>
            <p className="mt-2 text-2xl font-semibold text-rose-700 tabular-nums">{riskClients}</p>
          </div>
          <div className="rounded-xl border border-amber-200/70 bg-amber-50/70 p-4">
            <p className="section-label text-amber-700">À surveiller</p>
            <p className="mt-2 text-2xl font-semibold text-amber-700 tabular-nums">{watchClients}</p>
          </div>
          <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-4">
            <p className="section-label text-emerald-700">Sains</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-700 tabular-nums">{healthyClients}</p>
          </div>
        </div>
        <ClientsList clients={clientRows} deactivateAction={deactivateTenant} />
      </section>
    </div>
  );
}

export const dynamic = "force-dynamic";
