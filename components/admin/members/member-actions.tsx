"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { removeTenantMemberState, updateTenantMemberRoleState } from "@/app/(admin)/admin/clients/[tenantId]/members/actions";

type State = { ok?: boolean; message?: string };

export function MemberRoleForm({
  tenantId,
  userId,
  defaultRole,
}: {
  tenantId: string;
  userId: string;
  defaultRole: string;
}) {
  const [state, action] = useFormState(updateTenantMemberRoleState, {} as any);

  const PendingButton = () => {
    const { pending } = useFormStatus();
    return (
      <Button type="submit" size="sm" variant="outline" className="h-8 text-xs" disabled={pending}>
        {pending ? "…" : "Modifier"}
      </Button>
    );
  };

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="user_id" value={userId} />
      <select
        name="role"
        defaultValue={defaultRole}
        className="h-8 rounded-md border border-input bg-white px-2 text-xs"
      >
        <option value="client_user">client_user</option>
        <option value="client_manager">client_manager</option>
      </select>
      <PendingButton />
      {state?.message ? (
        <span className={`text-[10px] ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</span>
      ) : null}
    </form>
  );
}

export function MemberRemoveForm({ tenantId, userId }: { tenantId: string; userId: string }) {
  const [state, action] = useFormState(removeTenantMemberState, {} as any);

  const PendingButton = () => {
    const { pending } = useFormStatus();
    return (
      <Button
        type="submit"
        size="sm"
        variant="ghost"
        className="h-8 text-xs text-rose-700 hover:bg-rose-100"
        disabled={pending}
      >
        {pending ? "…" : "Retirer"}
      </Button>
    );
  };

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="user_id" value={userId} />
      <PendingButton />
      {state?.message ? (
        <span className={`text-[10px] ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</span>
      ) : null}
    </form>
  );
}
