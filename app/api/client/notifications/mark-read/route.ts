import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionProfile, getUserTenants } from "@/lib/auth";

/**
 * Mark notifications as read for the current tenant.
 *
 * Body:
 *  - { id: string } -> mark single notification
 *  - { all: true }  -> mark all as read
 */
export async function POST(request: Request) {
  const profile = await getSessionProfile();
  const supabase = createSupabaseServerClient();

  // Resolve tenant:
  // - default: profile.tenant_id
  // - optional: body.tenantId (only if the user has access to that tenant)
  const body = await request.json().catch(() => ({}));

  let tenantId = profile.tenant_id;
  const requestedTenantId = typeof body?.tenantId === "string" ? body.tenantId : null;
  if (requestedTenantId && profile.id) {
    const tenants = await getUserTenants(profile.id);
    if (tenants.some((t) => t.id === requestedTenantId)) {
      tenantId = requestedTenantId;
    }
  }

  if (!tenantId) {
    return NextResponse.json({ error: "No tenant" }, { status: 400 });
  }

  if (body?.all === true) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("tenant_id", tenantId)
      .eq("is_read", false);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
