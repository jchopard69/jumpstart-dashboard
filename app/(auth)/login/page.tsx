"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

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
      setError(signInError.message);
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role,tenant_id")
      .eq("email", email)
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
              Le cockpit social media premium de vos clients.
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Centralisez les performances, l&apos;historique et les documents dans une expérience élégante et fluide.
            </p>
          </div>
          <div className="mt-8 space-y-3 text-sm text-muted-foreground">
            <p>✔ Rapports consolidés multi-plateformes</p>
            <p>✔ Données mises à jour quotidiennement</p>
            <p>✔ Export PDF/CSV prêt à partager</p>
          </div>
        </div>

        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="text-2xl">Bienvenue</CardTitle>
            <CardDescription>Connectez-vous à votre espace Social Pulse.</CardDescription>
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
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
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
