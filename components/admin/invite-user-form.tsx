"use client";

import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type InviteUserFormProps = {
  tenantId: string;
  action: (
    prevState: { error?: string; success?: string } | null,
    formData: FormData
  ) => Promise<{ error?: string; success?: string }>;
};

export function InviteUserForm({ tenantId, action }: InviteUserFormProps) {
  const [state, formAction] = useFormState(action, null);

  return (
    <div>
      <form action={formAction} className="mt-4 grid gap-4 md:grid-cols-4">
        <Input name="email" type="email" placeholder="email@client.com" required />
        <Input name="full_name" placeholder="Nom complet" />
        <select
          name="role"
          defaultValue="client_user"
          className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
        >
          <option value="client_user">Utilisateur client</option>
          <option value="client_manager">Manager client</option>
          <option value="agency_admin">Admin agence</option>
        </select>
        <input type="hidden" name="tenant_id" value={tenantId} />
        <Button type="submit">Envoyer l&apos;invitation</Button>
      </form>
      {state?.error && (
        <p className="mt-3 text-sm text-destructive">{state.error}</p>
      )}
      {state?.success && (
        <p className="mt-3 text-sm text-emerald-600">{state.success}</p>
      )}
    </div>
  );
}
