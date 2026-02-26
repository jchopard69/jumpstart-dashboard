"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_token: "Le lien d'invitation a expire. Demandez a votre administrateur de vous renvoyer une invitation.",
  no_profile: "Votre compte n'est pas encore configure. Contactez votre administrateur.",
};

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  useEffect(() => {
    const fromUrl = searchParams.get("email");
    if (fromUrl) {
      setEmail(fromUrl);
    }
  }, [searchParams]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.error || "Échec de la connexion.");
        return;
      }
      router.push(payload?.redirectTo || "/client/dashboard");
      router.refresh();
    } catch {
      setError("Échec de la connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="card-glass">
      <CardHeader>
        <CardTitle className="text-2xl">Bienvenue</CardTitle>
        <CardDescription>Accedez a votre espace Social Pulse.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleLogin}>
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Mot de passe</Label>
              <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Mot de passe oublie ?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {(error || (urlError && ERROR_MESSAGES[urlError])) && (
            <p className="text-sm text-destructive">
              {error || ERROR_MESSAGES[urlError!]}
            </p>
          )}
          <Button className="w-full" disabled={loading}>
            {loading ? "Connexion..." : "Se connecter"}
          </Button>
          <div className="pt-1 text-center">
            <Link href="/demo" className="text-xs text-muted-foreground underline hover:text-foreground">
              Tester le compte démo
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen gradient-hero px-6 py-12">
      <div className="mx-auto grid w-full max-w-5xl items-stretch gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <div className="surface-panel flex flex-col justify-between p-8">
          <div>
            <div className="flex items-center gap-3">
              <Image src="/jumpstart-logo.png" alt="JumpStart Studio" width={160} height={36} />
              <span className="rounded-full px-3 py-1 text-xs font-semibold brand-pill">Acces securise</span>
            </div>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight font-display">
              Votre intelligence sociale, centralisee.
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Pilotez la strategie digitale de vos clients avec des donnees consolidees, des insights actionnables et un suivi premium.
            </p>
          </div>
          <div className="mt-8 space-y-3 text-sm text-muted-foreground">
            <p>&#10004; Scoring proprietaire JumpStart Score</p>
            <p>&#10004; Insights strategiques auto-generes</p>
            <p>&#10004; Rapports PDF premium prets a partager</p>
          </div>
        </div>

        <Suspense fallback={
          <Card className="card-glass">
            <CardHeader>
              <CardTitle className="text-2xl">Bienvenue</CardTitle>
              <CardDescription>Chargement...</CardDescription>
            </CardHeader>
          </Card>
        }>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
