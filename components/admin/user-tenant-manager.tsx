"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings, Trash2, Plus, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

type Tenant = {
  id: string;
  name: string;
  slug: string;
};

interface UserTenantManagerProps {
  userId: string;
  userEmail: string;
  currentTenantId: string | null;
  additionalTenants: string[];
  allTenants: Tenant[];
  updatePrimaryAction: (formData: FormData) => Promise<void>;
  addAccessAction: (formData: FormData) => Promise<void>;
  removeAccessAction: (formData: FormData) => Promise<void>;
  deleteUserAction: (formData: FormData) => Promise<void>;
}

export function UserTenantManager({
  userId,
  userEmail,
  currentTenantId,
  additionalTenants,
  allTenants,
  updatePrimaryAction,
  addAccessAction,
  removeAccessAction,
  deleteUserAction
}: UserTenantManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const availableForPrimary = allTenants;
  const availableForAccess = allTenants.filter(
    (t) => t.id !== currentTenantId && !additionalTenants.includes(t.id)
  );

  const handleUpdatePrimary = (tenantId: string | null) => {
    const formData = new FormData();
    formData.set("user_id", userId);
    formData.set("tenant_id", tenantId ?? "");
    startTransition(() => updatePrimaryAction(formData));
  };

  const handleAddAccess = (tenantId: string) => {
    const formData = new FormData();
    formData.set("user_id", userId);
    formData.set("tenant_id", tenantId);
    startTransition(() => addAccessAction(formData));
  };

  const handleRemoveAccess = (tenantId: string) => {
    const formData = new FormData();
    formData.set("user_id", userId);
    formData.set("tenant_id", tenantId);
    startTransition(() => removeAccessAction(formData));
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const formData = new FormData();
    formData.set("user_id", userId);
    startTransition(() => deleteUserAction(formData));
  };

  return (
    <DropdownMenu onOpenChange={() => setConfirmDelete(false)}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={isPending}>
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[220px]">
        <DropdownMenuLabel className="truncate">{userEmail}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Workspace principal</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => handleUpdatePrimary(null)}>
              <span className={!currentTenantId ? "font-semibold" : ""}>Aucun (admin)</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {availableForPrimary.map((tenant) => (
              <DropdownMenuItem
                key={tenant.id}
                onClick={() => handleUpdatePrimary(tenant.id)}
              >
                <span className={currentTenantId === tenant.id ? "font-semibold" : ""}>
                  {tenant.name}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {availableForAccess.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Plus className="mr-2 h-3 w-3" />
              Ajouter accès
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {availableForAccess.map((tenant) => (
                <DropdownMenuItem
                  key={tenant.id}
                  onClick={() => handleAddAccess(tenant.id)}
                >
                  {tenant.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {additionalTenants.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <X className="mr-2 h-3 w-3" />
              Retirer accès
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {additionalTenants.map((tenantId) => {
                const tenant = allTenants.find((t) => t.id === tenantId);
                return (
                  <DropdownMenuItem
                    key={tenantId}
                    onClick={() => handleRemoveAccess(tenantId)}
                  >
                    {tenant?.name ?? tenantId}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={handleDelete}
        >
          <Trash2 className="mr-2 h-3 w-3" />
          {confirmDelete ? "Confirmer suppression" : "Supprimer"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
