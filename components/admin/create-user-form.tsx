"use client";

import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Tenant = { id: string; name: string };

type CreateUserFormProps = {
  tenants: Tenant[];
  action: (
    prevState: { error?: string; success?: boolean } | null,
    formData: FormData
  ) => Promise<{ error?: string; success?: boolean }>;
};

export function CreateUserForm({ tenants, action }: CreateUserFormProps) {
  const [state, formAction] = useFormState(action, null);

  return (
    <form action={formAction} className="mt-4 grid gap-4 md:grid-cols-5">
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
        <Input name="password" type="text" placeholder="Min. 8 caracteres" required minLength={8} />
      </div>
      <div>
        <Label>Role</Label>
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
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-5 flex items-center gap-4">
        <Button type="submit">Creer l&apos;utilisateur</Button>
        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        {state?.success && (
          <p className="text-sm text-emerald-600">Utilisateur cree avec succes !</p>
        )}
      </div>
    </form>
  );
}
