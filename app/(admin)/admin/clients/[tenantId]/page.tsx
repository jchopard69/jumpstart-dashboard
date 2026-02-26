import type { Metadata } from "next";
import { getSessionProfile, requireAdmin } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  inviteUser,
  updateCollaboration,
  addUpcomingShoot,
  uploadDocumentMetadata,
  triggerTenantSync,
  deleteSocialAccount,
  resetLinkedInData,
  addTenantAccess,
  removeTenantAccess,
  updateTenantGoals
} from "@/app/(admin)/admin/actions";
import { DocumentManager } from "@/components/admin/document-manager";
import { SocialAccountsSection } from "@/components/admin/social-accounts-section";
import { MultiTenantAccess } from "@/components/admin/multi-tenant-access";
import { InviteUserForm } from "@/components/admin/invite-user-form";
import type { Platform } from "@/lib/types";

export async function generateMetadata({ params }: { params: { tenantId: string } }): Promise<Metadata> {
  const supabase = createSupabaseServiceClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", params.tenantId)
    .single();

  return {
    title: tenant?.name ?? "Client"
  };
}

export default async function ClientDetailPage({ params }: { params: { tenantId: string } }) {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const supabase = createSupabaseServiceClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id,name,slug,is_demo")
    .eq("id", params.tenantId)
    .single();
  const isDemoTenant = Boolean(tenant?.is_demo);
  const { data: users } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,created_at")
    .eq("tenant_id", params.tenantId)
    .order("created_at", { ascending: false });
  const { data: accounts } = await supabase
    .from("social_accounts")
    .select("id,platform,account_name,external_account_id,auth_status,last_sync_at")
    .eq("tenant_id", params.tenantId)
    .order("created_at", { ascending: false });
  const { data: collaboration } = await supabase
    .from("collaboration")
    .select("shoot_days_remaining,notes")
    .eq("tenant_id", params.tenantId)
    .single();
  const { data: shoots } = await supabase
    .from("upcoming_shoots")
    .select("id,shoot_date,location,notes")
    .eq("tenant_id", params.tenantId)
    .order("shoot_date", { ascending: true });
  const { data: documents } = await supabase
    .from("documents")
    .select("id,file_name,tag,pinned,created_at")
    .eq("tenant_id", params.tenantId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  const { data: logs } = await supabase
    .from("sync_logs")
    .select("id,platform,status,started_at,finished_at,rows_upserted,error_message")
    .eq("tenant_id", params.tenantId)
    .order("started_at", { ascending: false })
    .limit(10);
  const { data: goals } = await supabase
    .from("tenant_goals")
    .select("followers_target,engagement_rate_target,posts_per_week_target,reach_target,views_target")
    .eq("tenant_id", params.tenantId)
    .maybeSingle();

  const { data: allUsers } = await supabase
    .from("profiles")
    .select("id,email,full_name,tenant_id")
    .neq("tenant_id", params.tenantId)
    .neq("role", "agency_admin")
    .order("email");

  const { data: tenantAccess } = await supabase
    .from("user_tenant_access")
    .select("user_id")
    .eq("tenant_id", params.tenantId);

  const accessUserIds = new Set((tenantAccess ?? []).map((a) => a.user_id));

  const usersWithAccess = (allUsers ?? []).map((user) => ({
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    hasAccess: accessUserIds.has(user.id)
  }));

  return (
    <div className="space-y-8 fade-in">
      <section className="surface-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="section-label">Centre de controle</p>
            <h1 className="page-heading">{tenant?.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{tenant?.slug}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">Workspace client</Badge>
            {isDemoTenant && <Badge variant="outline">MODE DÉMO</Badge>}
            <a
              className="text-sm font-medium text-primary underline"
              href={`/client/dashboard?tenantId=${params.tenantId}`}
            >
              Voir le dashboard
            </a>
            <a
              className="text-sm font-medium text-primary underline"
              href={`/client/collaboration?tenantId=${params.tenantId}`}
            >
              Ma collaboration
            </a>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="section-title">Synchronisation immédiate</h2>
            <p className="text-sm text-muted-foreground">
              {isDemoTenant
                ? "Le mode démo est en lecture seule: la synchro et les connexions externes sont bloquées."
                : "Lancer un refresh complet pour ce client."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <form action={triggerTenantSync}>
              <input type="hidden" name="tenant_id" value={params.tenantId} />
              <Button type="submit" disabled={isDemoTenant}>Lancer la synchro</Button>
            </form>
            <form action={resetLinkedInData}>
              <input type="hidden" name="tenant_id" value={params.tenantId} />
              <Button variant="outline" type="submit" disabled={isDemoTenant}>Reset LinkedIn</Button>
            </form>
          </div>
        </div>
      </section>

      <Card className="card-surface p-6 fade-in-up">
        <h2 className="section-title">Inviter un utilisateur</h2>
        {isDemoTenant ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Les invitations sont désactivées pour le workspace démo.
          </p>
        ) : (
          <InviteUserForm tenantId={params.tenantId} action={inviteUser} />
        )}

        <div className="mt-6">
          <Table className="table-premium">
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rôle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(users ?? []).map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.full_name ?? "-"}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.role}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <SocialAccountsSection
        tenantId={params.tenantId}
        isDemo={isDemoTenant}
        accounts={(accounts ?? []).map((a) => ({
          ...a,
          platform: a.platform as Platform,
        }))}
        deleteAction={deleteSocialAccount}
      />

      <Card className="card-surface p-6 fade-in-up">
        <h2 className="section-title">Objectifs de performance</h2>
        <p className="text-sm text-muted-foreground mt-1">Definissez des cibles pour suivre la progression sur le dashboard client.</p>
        <form action={updateTenantGoals} className="mt-4 grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          <div>
            <Label>Abonnés cible</Label>
            <Input name="followers_target" type="number" placeholder="Ex: 10000" defaultValue={goals?.followers_target ?? ""} disabled={isDemoTenant} />
          </div>
          <div>
            <Label>Taux d'engagement cible (%)</Label>
            <Input name="engagement_rate_target" type="number" step="0.1" placeholder="Ex: 3.5" defaultValue={goals?.engagement_rate_target ?? ""} disabled={isDemoTenant} />
          </div>
          <div>
            <Label>Posts / semaine</Label>
            <Input name="posts_per_week_target" type="number" placeholder="Ex: 4" defaultValue={goals?.posts_per_week_target ?? ""} disabled={isDemoTenant} />
          </div>
          <div>
            <Label>Portée cible</Label>
            <Input name="reach_target" type="number" placeholder="Ex: 50000" defaultValue={goals?.reach_target ?? ""} disabled={isDemoTenant} />
          </div>
          <div>
            <Label>Vues cible</Label>
            <Input name="views_target" type="number" placeholder="Ex: 100000" defaultValue={goals?.views_target ?? ""} disabled={isDemoTenant} />
          </div>
          <input type="hidden" name="tenant_id" value={params.tenantId} />
          <Button type="submit" disabled={isDemoTenant}>Sauvegarder les objectifs</Button>
        </form>
      </Card>

      <Card className="card-surface p-6 fade-in-up">
        <h2 className="section-title">Collaboration</h2>
        <form action={updateCollaboration} className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <Label>Jours de shooting restants</Label>
            <Input name="shoot_days_remaining" type="number" defaultValue={collaboration?.shoot_days_remaining ?? 0} disabled={isDemoTenant} />
          </div>
          <div className="md:col-span-2">
            <Label>Notes internes</Label>
            <Input name="notes" defaultValue={collaboration?.notes ?? ""} disabled={isDemoTenant} />
          </div>
          <input type="hidden" name="tenant_id" value={params.tenantId} />
          <Button type="submit" disabled={isDemoTenant}>Mettre à jour</Button>
        </form>

        <div className="mt-6">
          <h3 className="text-sm font-semibold">Shootings à venir</h3>
          <form action={addUpcomingShoot} className="mt-2 grid gap-3 md:grid-cols-4">
            <Input name="shoot_date" type="datetime-local" required disabled={isDemoTenant} />
            <Input name="location" placeholder="Lieu" disabled={isDemoTenant} />
            <Input name="notes" placeholder="Notes" disabled={isDemoTenant} />
            <input type="hidden" name="tenant_id" value={params.tenantId} />
            <Button type="submit" disabled={isDemoTenant}>Ajouter un shooting</Button>
          </form>
          <div className="mt-4 space-y-2">
            {(shoots ?? []).map((shoot) => (
              <div key={shoot.id} className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                <p className="text-sm font-medium">{new Date(shoot.shoot_date).toLocaleString("fr-FR")}</p>
                <p className="text-xs text-muted-foreground">{shoot.location}</p>
                {shoot.notes ? <p className="text-xs text-muted-foreground">{shoot.notes}</p> : null}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="card-surface p-6 fade-in-up">
        <h2 className="section-title">Documents</h2>
        {isDemoTenant ? (
          <p className="mt-2 text-sm text-muted-foreground">Le dépôt de documents est verrouillé en mode démo.</p>
        ) : (
          <DocumentManager tenantId={params.tenantId} uploadAction={uploadDocumentMetadata} />
        )}
        <div className="mt-6">
          <Table className="table-premium">
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead>Épinglé</TableHead>
                <TableHead>Ajouté le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(documents ?? []).map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>{doc.file_name}</TableCell>
                  <TableCell>{doc.tag}</TableCell>
                  <TableCell>{doc.pinned ? "Oui" : "Non"}</TableCell>
                  <TableCell>{new Date(doc.created_at).toLocaleDateString("fr-FR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {!isDemoTenant && (
        <MultiTenantAccess
          tenantId={params.tenantId}
          tenantName={tenant?.name ?? ""}
          usersWithAccess={usersWithAccess}
          addAction={addTenantAccess}
          removeAction={removeTenantAccess}
        />
      )}

      <Card className="card-surface p-6 fade-in-up">
        <h2 className="section-title">Logs de synchronisation</h2>
        <Table className="table-premium">
          <TableHeader>
            <TableRow>
              <TableHead>Plateforme</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Démarré</TableHead>
              <TableHead>Terminé</TableHead>
              <TableHead>Lignes</TableHead>
              <TableHead>Erreur</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(logs ?? []).map((log) => (
              <TableRow key={log.id}>
                <TableCell>{log.platform}</TableCell>
                <TableCell>{log.status}</TableCell>
                <TableCell>{new Date(log.started_at).toLocaleString("fr-FR")}</TableCell>
                <TableCell>{log.finished_at ? new Date(log.finished_at).toLocaleString("fr-FR") : "-"}</TableCell>
                <TableCell>{log.rows_upserted ?? 0}</TableCell>
                <TableCell className="max-w-[240px] truncate">{log.error_message ?? "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export const dynamic = "force-dynamic";
