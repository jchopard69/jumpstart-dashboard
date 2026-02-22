"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check if user has a valid session from the callback
    const checkSession = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    checkSession();
  }, []);

  const handleSetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caracteres.");
      return;
    }

    setLoading(true);

    const supabase = createSupabaseBrowserClient();

    // Update the user's password
    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);

    // Fetch profile to determine redirect
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("role,tenant_id")
      .eq("id", user?.id ?? "")
      .single();

    // Redirect after a short delay
    setTimeout(() => {
      if (profile?.role === "agency_admin") {
        router.push("/admin");
      } else {
        router.push("/client/dashboard");
      }
    }, 2000);
  };

  return (
    <div className="min-h-screen gradient-hero px-6 py-12">
      <div className="mx-auto grid w-full max-w-5xl items-stretch gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <div className="surface-panel flex flex-col justify-between p-8">
          <div>
            <div className="flex items-center gap-3">
              <Image src="/jumpstart-logo.png" alt="JumpStart Studio" width={160} height={36} />
              <span className="rounded-full px-3 py-1 text-xs font-semibold brand-pill">Nouveau compte</span>
            </div>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight font-display">
              Bienvenue dans votre espace client.
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Creez votre mot de passe pour acceder a votre tableau de bord personnalise.
            </p>
          </div>
          <div className="mt-8 space-y-3 text-sm text-muted-foreground">
            <p>Conseils pour un mot de passe securise :</p>
            <p>- Au moins 8 caracteres</p>
            <p>- Melangez lettres, chiffres et symboles</p>
            <p>- Evitez les mots de passe courants</p>
          </div>
        </div>

        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="text-2xl">Creer votre mot de passe</CardTitle>
            <CardDescription>
              {userEmail ? (
                <>Compte : <strong>{userEmail}</strong></>
              ) : (
                "Definissez un mot de passe securise pour votre compte."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-lg font-medium">Mot de passe cree avec succes !</p>
                <p className="text-sm text-muted-foreground">Redirection vers votre tableau de bord...</p>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSetPassword}>
                <div className="space-y-2">
                  <Label htmlFor="password">Nouveau mot de passe</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minimum 8 caracteres"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Retapez votre mot de passe"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                  />
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <Button className="w-full" disabled={loading}>
                  {loading ? "Creation en cours..." : "Creer mon mot de passe"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
