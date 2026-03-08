"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inviteTenantMemberState } from "@/app/(admin)/admin/clients/[tenantId]/members/actions";

type State = { ok?: boolean; message?: string };

export function MemberInviteForm({ tenantId }: { tenantId: string }) {
  const [state, action] = useFormState(inviteTenantMemberState, {} as any);

  const PendingButton = () => {
    const { pending } = useFormStatus();
    return (
      <Button type="submit" disabled={pending}>
        {pending ? "…" : "Inviter"}
      </Button>
    );
  };

  return (
    <form action={action} className="mt-5 grid gap-3 sm:grid-cols-3">
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
        <PendingButton />
      </div>

      {state?.message && (
        <div className="sm:col-span-3">
          <div
            className={`rounded-xl border p-3 text-xs ${
              state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {state.message}
          </div>
        </div>
      )}
    </form>
  );
}
