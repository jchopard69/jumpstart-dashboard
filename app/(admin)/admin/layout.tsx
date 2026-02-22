import Image from "next/image";
import Link from "next/link";
import { getSessionProfile, requireAdmin } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();
  requireAdmin(profile);

  async function signOut() {
    "use server";
    const client = createSupabaseServerClient();
    await client.auth.signOut();
  }

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
                  <p className="mt-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">Console agence</p>
                  <nav className="mt-6 flex flex-col gap-2 text-sm">
                    <Link className="nav-pill" href="/admin">
                      Vue d&apos;ensemble
                    </Link>
                    <Link className="nav-pill" href="/admin/clients">
                      Clients
                    </Link>
                    <Link className="nav-pill" href="/admin/users">
                      Utilisateurs
                    </Link>
                    <Link className="nav-pill" href="/admin/health">
                      Santé
                    </Link>
                    <Link className="nav-pill" href="/admin/settings">
                      Réglages
                    </Link>
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
              <header className="sticky top-0 z-30 border-b border-border/70 bg-white/80 backdrop-blur xl:hidden">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Image src="/jumpstart-logo.png" alt="JumpStart Studio" width={120} height={28} priority />
                    <span className="hidden sm:inline-flex rounded-full bg-purple-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-700">
                      Admin
                    </span>
                  </div>
                  <nav className="flex items-center gap-2">
                    <Link className="nav-pill" href="/admin">
                      Vue d&apos;ensemble
                    </Link>
                    <Link className="nav-pill" href="/admin/clients">
                      Clients
                    </Link>
                    <Link className="nav-pill" href="/admin/users">
                      Utilisateurs
                    </Link>
                    <Link className="nav-pill" href="/admin/health">
                      Santé
                    </Link>
                    <Link className="nav-pill" href="/admin/settings">
                      Réglages
                    </Link>
                  </nav>
                  <form action={signOut} className="hidden sm:block">
                    <Button variant="outline" size="sm" type="submit">
                      Déconnexion
                    </Button>
                  </form>
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
