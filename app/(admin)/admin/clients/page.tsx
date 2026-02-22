import type { Metadata } from "next";
import Link from "next/link";
import { getSessionProfile, requireAdmin } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { createTenant, deactivateTenant } from "@/app/(admin)/admin/actions";

export const metadata: Metadata = {
  title: "Admin - Clients"
};

export default async function AdminClientsPage() {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const supabase = createSupabaseServiceClient();
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id,name,slug,is_active,created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8 fade-in">
      <section className="surface-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Admin agence</p>
            <h1 className="page-heading">Clients</h1>
            <p className="mt-2 text-sm text-muted-foreground">Pilotez les espaces clients et leurs accès.</p>
          </div>
          <Badge variant="secondary">Gestion des tenants</Badge>
        </div>
        <form action={createTenant} className="mt-6 grid gap-4 md:grid-cols-[1.4fr_1fr_auto]">
          <Input name="name" placeholder="Nom du client" required />
          <Input name="slug" placeholder="client-slug" required />
          <Button type="submit">Créer</Button>
        </form>
      </section>

      <div className="grid gap-4">
        {(tenants ?? []).map((tenant) => (
          <Card key={tenant.id} className="card-surface p-6 fade-in-up">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">{tenant.name}</h3>
                <p className="text-sm text-muted-foreground">{tenant.slug}</p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  className={cn(buttonVariants({ variant: "outline" }))}
                  href={`/admin/clients/${tenant.id}`}
                >
                  Gérer
                </Link>
                {tenant.is_active ? (
                  <form action={deactivateTenant}>
                    <input type="hidden" name="tenantId" value={tenant.id} />
                    <Button variant="destructive" type="submit">
                      Désactiver
                    </Button>
                  </form>
                ) : (
                  <span className="text-xs text-muted-foreground">Inactif</span>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
