import Image from "next/image";
import { getSessionProfile, requireClientAccess, getUserTenants } from "@/lib/auth";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavLink } from "@/components/layout/nav-link";
import { TenantSwitcher } from "@/components/layout/tenant-switcher";
import { ClientSwitcher, type ClientInfo } from "@/components/admin/client-switcher";
import type { Platform, SyncStatus } from "@/lib/types";
import { cookies } from "next/headers";

const TENANT_COOKIE = "active_tenant_id";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();
  if (profile.role !== "agency_admin") {
    await requireClientAccess(profile);
  }

  async function signOut() {
    "use server";
    const client = createSupabaseServerClient();
    await client.auth.signOut();
  }

  const isAdmin = profile.role === "agency_admin";

  const tenants = isAdmin ? [] : await getUserTenants(profile.id);
  const cookieStore = cookies();
  const cookieTenantId = cookieStore.get(TENANT_COOKIE)?.value;
  const currentTenantId = cookieTenantId && tenants.some((t) => t.id === cookieTenantId)
    ? cookieTenantId
    : profile.tenant_id ?? tenants[0]?.id ?? "";
  const currentTenant = tenants.find((tenant) => tenant.id === currentTenantId);
  const isDemoTenant = Boolean(currentTenant?.is_demo);

  // Fetch enriched tenant data for admin ClientSwitcher
  let clientsData: ClientInfo[] = [];
  if (isAdmin) {
    const supabase = createSupabaseServiceClient();
    const [{ data: allTenants }, { data: accounts }, { data: syncLogs }] = await Promise.all([
      supabase.from("tenants").select("id,name,slug,is_active").eq("is_active", true).order("name"),
      supabase.from("social_accounts").select("tenant_id,platform"),
      supabase.from("sync_logs").select("tenant_id,status,started_at").order("started_at", { ascending: false }),
    ]);

    const platformsByTenant = new Map<string, Set<Platform>>();
    for (const acc of accounts ?? []) {
      if (!platformsByTenant.has(acc.tenant_id)) platformsByTenant.set(acc.tenant_id, new Set());
      platformsByTenant.get(acc.tenant_id)!.add(acc.platform as Platform);
    }

    const lastSyncByTenant = new Map<string, { status: SyncStatus; started_at: string }>();
    for (const log of syncLogs ?? []) {
      if (!lastSyncByTenant.has(log.tenant_id)) {
        lastSyncByTenant.set(log.tenant_id, { status: log.status as SyncStatus, started_at: log.started_at });
      }
    }

    clientsData = (allTenants ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      is_active: t.is_active,
      platforms: Array.from(platformsByTenant.get(t.id) ?? []),
      lastSyncStatus: lastSyncByTenant.get(t.id)?.status ?? null,
      lastSyncAt: lastSyncByTenant.get(t.id)?.started_at ?? null,
    }));
  }

  return (
    <Toaster>
      <div className="min-h-screen bg-aurora">
        <div className="relative">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 left-12 h-72 w-72 rounded-full bg-purple-500/15 blur-3xl" />
            <div className="absolute right-12 top-16 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-indigo-400/10 blur-3xl" />
          </div>

          <div className="relative flex min-h-screen">
            {/* Desktop Sidebar */}
            <aside className="sticky top-0 hidden h-screen w-72 flex-col gap-6 px-6 py-8 xl:flex">
              <div className="surface-panel flex h-full flex-col justify-between p-6">
                <div>
                  <div className="flex items-center gap-3">
                    <Image src="/jumpstart-logo.png" alt="JumpStart Studio" width={140} height={32} priority />
                    <span className="rounded-full bg-purple-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-700">
                      Client
                    </span>
                    {isDemoTenant && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700">
                        Mode démo
                      </span>
                    )}
                  </div>
                  <p className="mt-3 section-label">Social Pulse</p>
                  {tenants.length > 1 && (
                    <div className="mt-4">
                      <TenantSwitcher tenants={tenants} currentTenantId={currentTenantId} />
                    </div>
                  )}
                  <nav className="mt-6 flex flex-col gap-2 text-sm">
                    <NavLink href="/client/dashboard">Tableau de bord</NavLink>
                    <NavLink href="/client/collaboration">Ma collaboration</NavLink>
                    {isAdmin && <NavLink href="/admin">Admin</NavLink>}
                  </nav>
                  {isAdmin && clientsData.length > 0 && (
                    <div className="mt-6 border-t border-border/50 pt-5">
                      <p className="mb-2 section-label">Changer de client</p>
                      <ClientSwitcher clients={clientsData} compact />
                    </div>
                  )}
                </div>
                <form action={signOut}>
                  <Button variant="outline" className="w-full" type="submit">
                    Déconnexion
                  </Button>
                </form>
              </div>
            </aside>

            <div className="flex-1">
              {/* Mobile Header */}
              <header className="sticky top-0 z-30 border-b border-border/70 bg-white/80 backdrop-blur xl:hidden">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <MobileNav isAdmin={isAdmin} signOutAction={signOut} />
                    <Image src="/jumpstart-logo.png" alt="JumpStart Studio" width={100} height={24} priority />
                  </div>
                  <div className="flex items-center gap-2">
                    {tenants.length > 1 && (
                      <TenantSwitcher tenants={tenants} currentTenantId={currentTenantId} />
                    )}
                    {isAdmin && clientsData.length > 0 && (
                      <ClientSwitcher clients={clientsData} />
                    )}
                    <span className="rounded-full bg-purple-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-700">
                      Client
                    </span>
                    {isDemoTenant && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700">
                        Mode démo
                      </span>
                    )}
                  </div>
                </div>
              </header>

              <main className="mx-auto max-w-[1200px] px-6 py-10">{children}</main>
            </div>
          </div>
        </div>
      </div>
    </Toaster>
  );
}
