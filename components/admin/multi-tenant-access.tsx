"use client";

import { useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { X } from "lucide-react";

type UserWithAccess = {
  id: string;
  email: string;
  full_name: string | null;
  hasAccess: boolean;
};

interface MultiTenantAccessProps {
  tenantId: string;
  tenantName: string;
  usersWithAccess: UserWithAccess[];
  addAction: (formData: FormData) => Promise<void>;
  removeAction: (formData: FormData) => Promise<void>;
}

export function MultiTenantAccess({
  tenantId,
  tenantName,
  usersWithAccess,
  addAction,
  removeAction
}: MultiTenantAccessProps) {
  const [isPending, startTransition] = useTransition();

  const usersWithCurrentAccess = usersWithAccess.filter((u) => u.hasAccess);
  const usersWithoutAccess = usersWithAccess.filter((u) => !u.hasAccess);

  const handleAdd = (userId: string) => {
    const formData = new FormData();
    formData.set("user_id", userId);
    formData.set("tenant_id", tenantId);
    startTransition(() => addAction(formData));
  };

  const handleRemove = (userId: string) => {
    const formData = new FormData();
    formData.set("user_id", userId);
    formData.set("tenant_id", tenantId);
    startTransition(() => removeAction(formData));
  };

  return (
    <Card className="card-surface p-6 fade-in-up">
      <h2 className="section-title">Accès multi-tenant</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Donner accès à ce workspace ({tenantName}) à des utilisateurs d&apos;autres tenants.
      </p>

      {usersWithCurrentAccess.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold mb-2">Utilisateurs avec accès additionnel</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersWithCurrentAccess.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.full_name ?? "-"}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(user.id)}
                      disabled={isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {usersWithoutAccess.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold mb-2">Ajouter un utilisateur</h3>
          <div className="flex flex-wrap gap-2">
            {usersWithoutAccess.slice(0, 10).map((user) => (
              <Button
                key={user.id}
                variant="outline"
                size="sm"
                onClick={() => handleAdd(user.id)}
                disabled={isPending}
              >
                {user.full_name || user.email}
              </Button>
            ))}
            {usersWithoutAccess.length > 10 && (
              <span className="text-sm text-muted-foreground self-center">
                +{usersWithoutAccess.length - 10} autres
              </span>
            )}
          </div>
        </div>
      )}

      {usersWithAccess.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          Aucun utilisateur disponible. Invitez d&apos;abord des utilisateurs dans d&apos;autres tenants.
        </p>
      )}
    </Card>
  );
}
