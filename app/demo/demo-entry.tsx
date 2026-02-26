"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type DemoEntryProps = {
  contactHref: string;
  demoEmail: string;
  expiresAtLabel: string | null;
};

export function DemoEntry({ contactHref, demoEmail, expiresAtLabel }: DemoEntryProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/demo/login", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.error || "Connexion démo indisponible.");
        return;
      }
      router.push(payload?.redirectTo || "/client/dashboard");
      router.refresh();
    } catch {
      setError("Connexion démo indisponible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="surface-panel p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              <p className="section-label">JumpStart Studio</p>
              <h1 className="page-heading mt-2">Compte démo</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Explorez un workspace complet avec données fictives réalistes, export PDF et analyse stratégique.
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Données 100% synthétiques, anonymisées et sans PII réelle.
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-white/85 px-5 py-4 text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Mode</p>
              <p className="mt-1 text-sm font-semibold">Démo sécurisée</p>
              {expiresAtLabel && (
                <p className="mt-2 text-xs text-muted-foreground">Expire le {expiresAtLabel}</p>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className="surface-panel p-6">
            <h2 className="section-title">Accès immédiat</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Cliquez pour entrer directement dans le workspace démo.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button onClick={handleStart} disabled={loading}>
                {loading ? "Connexion..." : "Accéder à la démo"}
              </Button>
              <a href={contactHref} className="text-sm font-medium text-primary underline">
                Demander une démo personnalisée
              </a>
            </div>
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          </div>

          <div className="surface-panel p-6">
            <p className="section-label">Identifiant</p>
            <p className="mt-2 text-sm font-medium">{demoEmail}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Le mot de passe est géré côté serveur et peut être roté à tout moment.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

