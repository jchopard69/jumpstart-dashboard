import type { Metadata } from "next";
import { getSessionProfile, requireAdmin } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTenant, deactivateTenant } from "@/app/(admin)/admin/actions";
import { ClientsList, type ClientRow } from "@/components/admin/clients-list";
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
  }));

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
        <ClientsList clients={clientRows} deactivateAction={deactivateTenant} />
      </section>
    </div>
  );
}

export const dynamic = "force-dynamic";
