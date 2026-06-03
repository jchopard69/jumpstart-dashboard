"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_token: "Le lien d'invitation a expiré. Demandez à votre administrateur de vous renvoyer une invitation.",
  no_profile: "Votre compte n'est pas encore configuré. Contactez votre administrateur.",
};

function LoginFormInner({ demoEnabled }: { demoEnabled: boolean }) {
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
        <CardDescription>Accédez à votre espace JumpStart OS.</CardDescription>
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
                Mot de passe oublié ?
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
          {demoEnabled && (
            <div className="pt-1 text-center">
              <Link href="/demo" className="text-xs text-muted-foreground underline hover:text-foreground">
                Tester le compte démo
              </Link>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

export function LoginForm({ demoEnabled }: { demoEnabled: boolean }) {
  return (
    <Suspense fallback={
      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="text-2xl">Bienvenue</CardTitle>
          <CardDescription>Chargement...</CardDescription>
        </CardHeader>
      </Card>
    }>
      <LoginFormInner demoEnabled={demoEnabled} />
    </Suspense>
  );
}
