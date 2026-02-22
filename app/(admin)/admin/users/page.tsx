import { getSessionProfile, requireAdmin } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  createUserWithPassword,
  updateUserPrimaryTenant,
  addTenantAccess,
  removeTenantAccess,
  deleteUser
} from "./actions";
import { UserTenantManager } from "@/components/admin/user-tenant-manager";

export default async function AdminUsersPage() {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const supabase = createSupabaseServiceClient();

  const { data: users } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,tenant_id,created_at")
    .order("created_at", { ascending: false });

  const { data: tenants } = await supabase
    .from("tenants")
    .select("id,name,slug")
    .eq("is_active", true)
    .order("name");

  const { data: allAccess } = await supabase
    .from("user_tenant_access")
    .select("user_id,tenant_id");

  const accessByUser = new Map<string, string[]>();
  for (const access of allAccess ?? []) {
    const existing = accessByUser.get(access.user_id) ?? [];
    existing.push(access.tenant_id);
    accessByUser.set(access.user_id, existing);
  }

  const tenantMap = new Map((tenants ?? []).map((t) => [t.id, t.name]));

  const usersWithAccess = (users ?? []).map((user) => ({
    ...user,
    primaryTenantName: user.tenant_id ? tenantMap.get(user.tenant_id) ?? null : null,
    additionalTenants: accessByUser.get(user.id) ?? []
  }));

  return (
    <div className="space-y-8 fade-in">
      <section className="surface-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Admin agence</p>
            <h1 className="page-heading">Utilisateurs</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Gérez les utilisateurs et leurs accès aux workspaces.
            </p>
          </div>
          <Badge variant="secondary">Gestion des accès</Badge>
        </div>
      </section>

      <Card className="card-surface p-6 fade-in-up">
        <h2 className="section-title">Créer un utilisateur</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Créez un compte avec un mot de passe temporaire. L&apos;utilisateur pourra le changer via &quot;Mot de passe oublié&quot;.
        </p>
        <form action={createUserWithPassword} className="mt-4 grid gap-4 md:grid-cols-5">
          <div>
            <Label>Email</Label>
            <Input name="email" type="email" placeholder="email@example.com" required />
          </div>
          <div>
            <Label>Nom complet</Label>
            <Input name="full_name" placeholder="Jean Dupont" />
          </div>
          <div>
            <Label>Mot de passe</Label>
            <Input name="password" type="text" placeholder="MotDePasse123!" required />
          </div>
          <div>
            <Label>Rôle</Label>
            <select
              name="role"
              defaultValue="client_user"
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="client_user">Utilisateur client</option>
              <option value="client_manager">Manager client</option>
              <option value="agency_admin">Admin agence</option>
            </select>
          </div>
          <div>
            <Label>Workspace principal</Label>
            <select
              name="tenant_id"
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="">Aucun (admin)</option>
              {(tenants ?? []).map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-5">
            <Button type="submit">Créer l&apos;utilisateur</Button>
          </div>
        </form>
      </Card>

      <Card className="card-surface p-6 fade-in-up">
        <h2 className="section-title">Tous les utilisateurs</h2>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Workspace principal</TableHead>
                <TableHead>Accès additionnels</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersWithAccess.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.full_name ?? "-"}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.role}</Badge>
                  </TableCell>
                  <TableCell>{user.primaryTenantName ?? <span className="text-muted-foreground">-</span>}</TableCell>
                  <TableCell>
                    {user.additionalTenants.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {user.additionalTenants.map((tenantId) => (
                          <Badge key={tenantId} variant="secondary" className="text-xs">
                            {tenantMap.get(tenantId) ?? tenantId}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <UserTenantManager
                      userId={user.id}
                      userEmail={user.email}
                      currentTenantId={user.tenant_id}
                      additionalTenants={user.additionalTenants}
                      allTenants={tenants ?? []}
                      updatePrimaryAction={updateUserPrimaryTenant}
                      addAccessAction={addTenantAccess}
                      removeAccessAction={removeTenantAccess}
                      deleteUserAction={deleteUser}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

export const dynamic = "force-dynamic";
