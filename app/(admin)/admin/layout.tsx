import Image from "next/image";
import { getSessionProfile, requireAdmin } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { AdminNavLink } from "@/components/admin/admin-nav-link";
import { ClientSwitcher, type ClientInfo } from "@/components/admin/client-switcher";
import { CommandPalette } from "@/components/admin/command-palette";
import type { Platform, SyncStatus } from "@/lib/types";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();
  requireAdmin(profile);

  async function signOut() {
    "use server";
    const client = createSupabaseServerClient();
    await client.auth.signOut();
  }

  // Fetch enriched tenant data for ClientSwitcher
  const supabase = createSupabaseServiceClient();
  const [{ data: tenants }, { data: accounts }, { data: syncLogs }] = await Promise.all([
    supabase.from("tenants").select("id,name,slug,is_active").eq("is_active", true).order("name"),
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

  // Build last sync per tenant (first occurrence since ordered desc)
  const lastSyncByTenant = new Map<string, { status: SyncStatus; started_at: string }>();
  for (const log of syncLogs ?? []) {
    if (!lastSyncByTenant.has(log.tenant_id)) {
      lastSyncByTenant.set(log.tenant_id, {
        status: log.status as SyncStatus,
        started_at: log.started_at,
      });
    }
  }

  const clientsData: ClientInfo[] = (tenants ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    is_active: t.is_active,
    platforms: Array.from(platformsByTenant.get(t.id) ?? []),
    lastSyncStatus: lastSyncByTenant.get(t.id)?.status ?? null,
    lastSyncAt: lastSyncByTenant.get(t.id)?.started_at ?? null,
  }));

  return (
    <Toaster>
      <div className="min-h-screen bg-aurora">
        <div className="relative">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 left-10 h-64 w-64 rounded-full bg-purple-500/15 blur-3xl" />
            <div className="absolute right-0 top-10 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
            <div className="absolute bottom-0 right-24 h-72 w-72 rounded-full bg-indigo-400/10 blur-3xl" />
          </div>

          <div className="relative flex min-h-screen">
            <aside className="sticky top-0 hidden h-screen w-72 flex-col gap-6 px-6 py-8 xl:flex">
              <div className="surface-panel flex h-full flex-col justify-between p-6">
                <div>
                  <div className="flex items-center gap-3">
                    <Image src="/jumpstart-logo.png" alt="JumpStart Studio" width={140} height={32} priority />
                    <span className="rounded-full bg-purple-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-700">
                      Admin
                    </span>
                  </div>
                  <p className="mt-3 section-label">Centre de controle</p>
                  <nav className="mt-6 flex flex-col gap-2 text-sm">
                    <AdminNavLink href="/admin">Vue d&apos;ensemble</AdminNavLink>
                    <AdminNavLink href="/admin/clients">Clients</AdminNavLink>
                    <AdminNavLink href="/admin/users">Utilisateurs</AdminNavLink>
                    <AdminNavLink href="/admin/health">Santé</AdminNavLink>
                    <AdminNavLink href="/admin/settings">Réglages</AdminNavLink>
                  </nav>

                  {/* Client Switcher */}
                  <div className="mt-6 border-t border-border/50 pt-5">
                    <p className="mb-2 section-label">Accès rapide</p>
                    <ClientSwitcher clients={clientsData} compact />
                  </div>
                </div>
                <form action={signOut}>
                  <Button variant="outline" className="w-full" type="submit">
                    Déconnexion
                  </Button>
                </form>
              </div>
            </aside>

            <div className="flex-1">
              <header className="sticky top-0 z-30 border-b border-border/70 bg-white/80 backdrop-blur xl:hidden">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Image src="/jumpstart-logo.png" alt="JumpStart Studio" width={120} height={28} priority />
                    <span className="hidden sm:inline-flex rounded-full bg-purple-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-700">
                      Admin
                    </span>
                  </div>
                  <nav className="flex items-center gap-2">
                    <AdminNavLink href="/admin">Vue d&apos;ensemble</AdminNavLink>
                    <AdminNavLink href="/admin/clients">Clients</AdminNavLink>
                    <AdminNavLink href="/admin/users">Utilisateurs</AdminNavLink>
                    <AdminNavLink href="/admin/health">Santé</AdminNavLink>
                    <AdminNavLink href="/admin/settings">Réglages</AdminNavLink>
                  </nav>
                  <div className="flex items-center gap-2">
                    <ClientSwitcher clients={clientsData} />
                    <form action={signOut} className="hidden sm:block">
                      <Button variant="outline" size="sm" type="submit">
                        Déconnexion
                      </Button>
                    </form>
                  </div>
                </div>
              </header>

              <main className="mx-auto max-w-[1200px] px-6 py-10">{children}</main>
            </div>
          </div>
        </div>

        {/* Command Palette (Cmd+K) */}
        <CommandPalette clients={clientsData} />
      </div>
    </Toaster>
  );
}
