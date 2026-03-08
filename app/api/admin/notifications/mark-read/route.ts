import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionProfile, requireAdmin } from "@/lib/auth";

/**
 * Admin-only endpoint to mark notifications as read for a given tenant.
 *
 * Body:
 *  - { tenantId: string, all: true }
 */
export async function POST(request: Request) {
  const profile = await getSessionProfile();
  requireAdmin(profile);

  const supabase = createSupabaseServerClient();
  const body = await request.json().catch(() => ({}));

  const tenantId = typeof body?.tenantId === "string" ? body.tenantId : null;
  if (!tenantId) {
    return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });
  }

  if (body?.all !== true) {
    return NextResponse.json({ error: "Only all=true is supported" }, { status: 400 });
  }

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
