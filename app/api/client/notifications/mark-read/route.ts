import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";

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

  // Resolve tenant: admins will usually use tenantId param elsewhere; for client view, use profile tenant.
  // If needed, we can extend this later to support admin marking read for a given tenant.
  const tenantId = profile.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));

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
