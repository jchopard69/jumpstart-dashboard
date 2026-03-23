import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionProfile, requireAdmin } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export async function generateMetadata({ params }: { params: { tenantId: string } }): Promise<Metadata> {
  const supabase = createSupabaseServiceClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", params.tenantId)
    .single();

  return {
    title: tenant?.name ? `Connexion LinkedIn - ${tenant.name}` : "Connexion LinkedIn",
  };
}

export default async function LinkedInConnectPage({ params }: { params: { tenantId: string } }) {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const supabase = createSupabaseServiceClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id,name,is_demo")
    .eq("id", params.tenantId)
    .maybeSingle();

  if (!tenant) {
    notFound();
  }

  const startHref = `/api/oauth/linkedin/start?tenantId=${tenant.id}`;

  return (
    <div className="mx-auto max-w-3xl space-y-8 fade-in">
      <section className="surface-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="section-label">LinkedIn</p>
            <h1 className="page-heading">Connexion OAuth</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Prépare la redirection LinkedIn pour {tenant.name} avec le branding JumpStart Studio visible avant l&apos;autorisation.
            </p>
          </div>
          <Badge variant="secondary">Validation branding</Badge>
        </div>
      </section>

      <Card className="card-surface p-8">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-3xl border border-border/60 bg-white px-5 py-4 shadow-sm">
              <Image src="/jumpstart-logo.png" alt="JumpStart Studio" width={180} height={40} priority />
            </div>
            <Badge variant="outline">Logo affiché côté site</Badge>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Continuer vers LinkedIn</h2>
            <p className="text-sm text-muted-foreground">
              Cette étape permet de vérifier le branding JumpStart Studio avant d&apos;ouvrir l&apos;écran d&apos;autorisation LinkedIn.
              Le logo visible ensuite sur LinkedIn doit correspondre à celui affiché ici.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/admin/clients/${tenant.id}`}>
              <Button variant="outline">Retour au client</Button>
            </Link>
            {tenant.is_demo ? (
              <Button disabled>Désactivé en démo</Button>
            ) : (
              <a href={startHref}>
                <Button>Continuer avec LinkedIn</Button>
              </a>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

