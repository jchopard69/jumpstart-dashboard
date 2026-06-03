"use client";

import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSuccess(true);
  };

  return (
    <div className="min-h-screen gradient-hero px-6 py-12">
      <div className="mx-auto grid w-full max-w-5xl items-stretch gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <div className="surface-panel jumpstart-header flex flex-col justify-between p-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="jumpstart-brand-mark" aria-hidden="true">J</div>
              <div>
                <p className="text-sm font-semibold text-foreground">JumpStart</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Studio</p>
              </div>
            </div>
            <h1 className="mt-6 text-3xl font-semibold font-display">
              Mot de passe oublié ?
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
            </p>
          </div>
          <div className="mt-8">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              &larr; Retour à la connexion
            </Link>
          </div>
        </div>

        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="text-2xl">Réinitialiser le mot de passe</CardTitle>
            <CardDescription>
              Entrez l&apos;email associé à votre compte.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-lg font-medium">Email envoyé !</p>
                <p className="text-sm text-muted-foreground">
                  Vérifiez votre boîte de réception et vos spams pour le lien de réinitialisation.
                </p>
                <Link href="/login">
                  <Button variant="outline" className="mt-4">
                    Retour à la connexion
                  </Button>
                </Link>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleResetPassword}>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="hello@jumpstartstudio.fr"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <Button className="w-full" disabled={loading}>
                  {loading ? "Envoi en cours..." : "Envoyer le lien"}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  <Link href="/login" className="hover:text-foreground transition-colors">
                    Retour à la connexion
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
