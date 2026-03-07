import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/notifications — fetch notifications for the current user's tenant
 */
export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Non authentifie." }, { status: 401 });
    }

    const tenantId = await resolveTenantId(supabase, user.id);
    if (!tenantId) {
      return NextResponse.json({ message: "Acces tenant indisponible." }, { status: 403 });
    }

    const serviceClient = createSupabaseServiceClient();
    const { data: notifications, error } = await serviceClient
      .from("notifications")
      .select("id, type, title, message, metadata, is_read, created_at")
      .eq("tenant_id", tenantId)
      .order("is_read", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[api/notifications] Query error:", error.message);
      return NextResponse.json({ message: "Erreur serveur." }, { status: 500 });
    }

    // Count unread
    const unreadCount = (notifications ?? []).filter((n) => !n.is_read).length;

    return NextResponse.json({ notifications: notifications ?? [], unreadCount });
  } catch (err) {
    console.error("[api/notifications] GET error:", err);
    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 });
  }
}

/**
 * PATCH /api/notifications — mark notifications as read
 * Body: { ids: string[] } or { markAllRead: true }
 */
export async function PATCH(request: Request) {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Non authentifie." }, { status: 401 });
    }

    const tenantId = await resolveTenantId(supabase, user.id);
    if (!tenantId) {
      return NextResponse.json({ message: "Acces tenant indisponible." }, { status: 403 });
    }

    const body = await request.json();
    const serviceClient = createSupabaseServiceClient();

    if (body.markAllRead === true) {
      const { error } = await serviceClient
        .from("notifications")
        .update({ is_read: true })
        .eq("tenant_id", tenantId)
        .eq("is_read", false);

      if (error) {
        console.error("[api/notifications] markAllRead error:", error.message);
        return NextResponse.json({ message: "Erreur serveur." }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (Array.isArray(body.ids) && body.ids.length > 0) {
      const { error } = await serviceClient
        .from("notifications")
        .update({ is_read: true })
        .eq("tenant_id", tenantId)
        .in("id", body.ids);

      if (error) {
        console.error("[api/notifications] markRead error:", error.message);
        return NextResponse.json({ message: "Erreur serveur." }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ message: "Parametres invalides." }, { status: 400 });
  } catch (err) {
    console.error("[api/notifications] PATCH error:", err);
    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveTenantId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string
): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, role")
    .eq("id", userId)
    .single();

  if (profile?.tenant_id) {
    return profile.tenant_id;
  }

  // Check multi-tenant access
  const { data: access } = await supabase
    .from("user_tenant_access")
    .select("tenant_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  return access?.tenant_id ?? null;
}
