import Image from "next/image";
import { getSessionProfile, requireClientAccess } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavLink } from "@/components/layout/nav-link";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();
  if (profile.role !== "agency_admin") {
    requireClientAccess(profile);
  }

  async function signOut() {
    "use server";
    const client = createSupabaseServerClient();
    await client.auth.signOut();
  }

  const isAdmin = profile.role === "agency_admin";

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
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">Social Pulse</p>
                  <nav className="mt-6 flex flex-col gap-2 text-sm">
                    <NavLink href="/client/dashboard">Tableau de bord</NavLink>
                    <NavLink href="/client/os">JumpStart OS</NavLink>
                    <NavLink href="/client/ads">Ads</NavLink>
                    <NavLink href="/client/documents">Documents</NavLink>
                    {isAdmin && <NavLink href="/admin">Admin</NavLink>}
                  </nav>
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
                  <span className="rounded-full bg-purple-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-700">
                    Client
                  </span>
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
