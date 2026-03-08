import type { Metadata } from "next";
import { getSessionProfile, requireAdmin } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inviteTenantMember } from "./actions";

export const metadata: Metadata = {
  title: "Admin - Membres"
};

export default async function TenantMembersPage({ params }: { params: { tenantId: string } }) {
  const profile = await getSessionProfile();
  requireAdmin(profile);

  const supabase = createSupabaseServiceClient();

  const tenantId = params.tenantId;

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id,name,slug")
    .eq("id", tenantId)
    .maybeSingle();

  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("id,email,full_name,role")
    .eq("tenant_id", tenantId);

  const { data: access } = await supabase
    .from("user_tenant_access")
    .select("id,user_id,role,created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  const userIds = Array.from(new Set([...(ownerProfile ?? []).map((p) => p.id), ...(access ?? []).map((a) => a.user_id)]));
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id,email,full_name,role").in("id", userIds)
    : { data: [] as any[] };

  const byId = new Map<string, any>();
  for (const p of profiles ?? []) byId.set(p.id, p);

  const members = [
    ...(ownerProfile ?? []).map((p) => ({
      user_id: p.id,
      email: p.email,
      full_name: p.full_name,
      role: p.role,
      source: "owner" as const,
      created_at: null as string | null,
    })),
    ...(access ?? []).map((a) => {
      const p = byId.get(a.user_id);
      return {
        user_id: a.user_id,
        email: p?.email ?? a.user_id,
        full_name: p?.full_name ?? null,
        role: a.role,
        source: "access" as const,
        created_at: a.created_at as string,
      };
    }),
  ];

  return (
    <div className="space-y-8 fade-in">
      <section className="surface-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="section-label">Admin</p>
            <h1 className="page-heading">Membres</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Workspace: <span className="font-medium text-foreground/80">{tenant?.name ?? tenantId}</span>
            </p>
          </div>
          <Badge variant="secondary">Accès</Badge>
        </div>
      </section>

      <Card className="card-surface p-6 fade-in-up">
        <h2 className="section-title">Inviter un membre</h2>
        <p className="text-sm text-muted-foreground">Ajoute un accès au workspace (et envoie une invitation si besoin).</p>

        <form action={inviteTenantMember} className="mt-5 grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="tenant_id" value={tenantId} />
          <Input name="email" type="email" placeholder="email@domaine.com" required />
          <Input name="full_name" placeholder="Nom (optionnel)" />
          <div className="flex items-center gap-2">
            <select
              name="role"
              defaultValue="client_user"
              className="h-10 rounded-md border border-input bg-white px-3 text-sm"
            >
              <option value="client_user">client_user</option>
              <option value="client_manager">client_manager</option>
            </select>
            <Button type="submit">Inviter</Button>
          </div>
        </form>

        <p className="mt-3 text-xs text-muted-foreground">
          Note: pour l’instant, le rôle <span className="font-medium">agency_admin</span> reste géré au niveau global.
        </p>
      </Card>

      <Card className="card-surface p-6 fade-in-up">
        <h2 className="section-title">Utilisateurs</h2>
        <p className="text-sm text-muted-foreground">Liste des accès (propriétaire + accès additionnels).</p>

        <div className="mt-5 space-y-3">
          {members.map((m) => (
            <div key={`${m.source}-${m.user_id}`} className="rounded-2xl border border-border/60 bg-white/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{m.full_name || m.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    {m.email}
                    {m.created_at ? ` · ajouté ${new Date(m.created_at).toLocaleDateString("fr-FR")}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={m.role === "agency_admin" ? "success" : "secondary"}>{m.role}</Badge>
                  {m.source === "owner" && <Badge variant="secondary">owner</Badge>}
                </div>
              </div>
            </div>
          ))}

          {!members.length ? (
            <p className="text-sm text-muted-foreground">Aucun membre.</p>
          ) : null}
        </div>
      </Card>

      <Card className="card-surface p-6 fade-in-up">
        <h2 className="section-title">À venir</h2>
        <p className="text-sm text-muted-foreground">
          Prochaine étape: invitations par email + gestion des rôles par tenant (agency-first).
        </p>
      </Card>
    </div>
  );
}

export const dynamic = "force-dynamic";
