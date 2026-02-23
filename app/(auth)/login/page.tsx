"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_token: "Le lien d'invitation a expire. Demandez a votre administrateur de vous renvoyer une invitation.",
  no_profile: "Votre compte n'est pas encore configure. Contactez votre administrateur.",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    setLoading(false);
    if (signInError) {
      if (signInError.message === "Invalid login credentials") {
        setError(
          "Identifiants incorrects. Si vous venez de recevoir une invitation, cliquez d'abord sur le lien dans l'email pour creer votre mot de passe."
        );
      } else if (signInError.message === "Email not confirmed") {
        setError("Votre email n'a pas encore ete confirme. Verifiez votre boite de reception.");
      } else {
        setError(signInError.message);
      }
      return;
    }
    // Fetch profile by auth user id (more robust than email)
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("role,tenant_id")
      .eq("id", user?.id ?? "")
      .single();
    if (profile?.role === "agency_admin") {
      router.push("/admin");
    } else {
      router.push("/client/dashboard");
    }
  };

  return (
    <div className="min-h-screen gradient-hero px-6 py-12">
      <div className="mx-auto grid w-full max-w-5xl items-stretch gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <div className="surface-panel flex flex-col justify-between p-8">
          <div>
            <div className="flex items-center gap-3">
              <Image src="/jumpstart-logo.png" alt="JumpStart Studio" width={160} height={36} />
              <span className="rounded-full px-3 py-1 text-xs font-semibold brand-pill">Accès sécurisé</span>
            </div>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight font-display">
              Votre intelligence sociale, centralisee.
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Pilotez la strategie digitale de vos clients avec des donnees consolidees, des insights actionnables et un suivi premium.
            </p>
          </div>
          <div className="mt-8 space-y-3 text-sm text-muted-foreground">
            <p>✔ Scoring proprietaire JumpStart Score</p>
            <p>✔ Insights strategiques auto-generes</p>
            <p>✔ Rapports PDF premium prets a partager</p>
          </div>
        </div>

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
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
