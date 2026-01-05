import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile, requireAdmin } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { selectLinkedInAccounts } from "@/app/(admin)/admin/actions";

export default async function LinkedInSelectPage({ params }: { params: { tenantId: string } }) {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const supabase = createSupabaseServiceClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id,name,slug")
    .eq("id", params.tenantId)
    .single();

  const { data: accounts } = await supabase
    .from("social_accounts")
    .select("id,account_name,external_account_id,auth_status")
    .eq("tenant_id", params.tenantId)
    .eq("platform", "linkedin")
    .eq("auth_status", "pending")
    .order("created_at", { ascending: false });

  if (!accounts?.length) {
    redirect(`/admin/clients/${params.tenantId}`);
  }

  return (
    <div className="space-y-8 fade-in">
      <section className="surface-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">LinkedIn</p>
            <h1 className="page-heading">Sélection des pages</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Choisis les pages LinkedIn à connecter pour {tenant?.name ?? "ce client"}.
            </p>
          </div>
          <Badge variant="secondary">Pages détectées</Badge>
        </div>
      </section>

      <form action={selectLinkedInAccounts} className="space-y-4">
        <input type="hidden" name="tenant_id" value={params.tenantId} />
        <Card className="card-surface p-6">
          <div className="space-y-3">
            {accounts.map((account) => (
              <label
                key={account.id}
                className="flex items-center justify-between rounded-2xl border border-border/60 bg-white/70 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{account.account_name}</p>
                  <p className="text-xs text-muted-foreground">{account.external_account_id}</p>
                </div>
                <input
                  type="checkbox"
                  name="account_ids"
                  value={account.id}
                  className="h-4 w-4 accent-purple-600"
                  defaultChecked
                />
              </label>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Link className="text-sm text-muted-foreground underline" href={`/admin/clients/${params.tenantId}`}>
              Annuler
            </Link>
            <Button type="submit">Valider la sélection</Button>
          </div>
        </Card>
      </form>
    </div>
  );
}

export const dynamic = "force-dynamic";
