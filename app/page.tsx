import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Accueil"
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16">
        <header className="space-y-4">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">JumpStart Studio</p>
          <h1 className="page-heading">JumpStart OS</h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            Tableau de bord social media pour piloter la performance, suivre la collaboration
            et centraliser les publications de vos comptes.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/login" className={cn(buttonVariants({ variant: "default" }))}>
              Se connecter
            </Link>
            <Link href="/privacy" className={cn(buttonVariants({ variant: "outline" }))}>
              Politique de confidentialité
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="surface-panel p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Performance</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Suivi clair des impressions, portée, engagements et publications pour vos clients.
            </p>
          </div>
          <div className="surface-panel p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Collaboration</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Gestion des tournages, montages, idées et prochaines priorités mensuelles.
            </p>
          </div>
          <div className="surface-panel p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Clients</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Accès sécurisé par client, avec reporting et historiques centralisés.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} JumpStart Studio</span>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-foreground">Conditions d&apos;utilisation</Link>
            <Link href="/privacy" className="hover:text-foreground">Politique de confidentialité</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
