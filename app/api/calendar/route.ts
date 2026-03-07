import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { isDemoTenant, logDemoAccess } from "@/lib/demo";

/**
 * Resolve the tenantId from the authenticated user's profile + user_tenant_access.
 * Returns null if user has no access.
 */
async function resolveTenantId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
  requestedTenantId?: string | null
): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id,role")
    .eq("id", userId)
    .single();

  let tenantId = profile?.tenant_id ?? null;

  if (requestedTenantId) {
    if (profile?.role === "agency_admin") {
      tenantId = requestedTenantId;
    } else {
      const { data: access } = await supabase
        .from("user_tenant_access")
        .select("tenant_id")
        .eq("user_id", userId)
        .eq("tenant_id", requestedTenantId)
        .maybeSingle();
      if (access || profile?.tenant_id === requestedTenantId) {
        tenantId = requestedTenantId;
      }
    }
  }

  return tenantId;
}

// ---------------------------------------------------------------------------
// GET  /api/calendar?tenantId=xxx&month=2026-03
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId");
    const month = searchParams.get("month"); // e.g. "2026-03"

    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Non authentifie." }, { status: 401 });
    }

    const tenantId = await resolveTenantId(supabase, user.id, requestedTenantId);
    if (!tenantId) {
      return NextResponse.json({ message: "Acces tenant indisponible." }, { status: 403 });
    }

    const serviceClient = createSupabaseServiceClient();

    let query = serviceClient
      .from("content_calendar")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("planned_date", { ascending: true, nullsFirst: false })
      .order("planned_time", { ascending: true, nullsFirst: false });

    if (month) {
      // Filter to entries within the given month
      const [year, mon] = month.split("-").map(Number);
      if (year && mon) {
        const startDate = `${year}-${String(mon).padStart(2, "0")}-01`;
        const endDate =
          mon === 12
            ? `${year + 1}-01-01`
            : `${year}-${String(mon + 1).padStart(2, "0")}-01`;
        query = query.gte("planned_date", startDate).lt("planned_date", endDate);
      }
    }

    const { data: entries, error } = await query;

    if (error) {
      console.error("[calendar] Failed to fetch entries:", error.message);
      return NextResponse.json({ message: "Erreur lors du chargement." }, { status: 500 });
    }

    return NextResponse.json({ entries: entries ?? [] });
  } catch (error) {
    console.error("[calendar] GET error", error);
    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST  /api/calendar  — Create a new entry
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Non authentifie." }, { status: 401 });
    }

    const body = await request.json();
    const tenantId = await resolveTenantId(supabase, user.id, body.tenantId);
    if (!tenantId) {
      return NextResponse.json({ message: "Acces tenant indisponible." }, { status: 403 });
    }

    if (await isDemoTenant(tenantId, supabase)) {
      logDemoAccess("calendar_create_blocked", { tenantId, userId: user.id });
      return NextResponse.json(
        { message: "Modification desactivee pour le workspace demo." },
        { status: 403 }
      );
    }

    if (!body.title || typeof body.title !== "string" || body.title.trim().length === 0) {
      return NextResponse.json({ message: "Le titre est requis." }, { status: 400 });
    }

    const serviceClient = createSupabaseServiceClient();
    const { data: entry, error } = await serviceClient
      .from("content_calendar")
      .insert({
        tenant_id: tenantId,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        platform: body.platform || null,
        planned_date: body.planned_date || null,
        planned_time: body.planned_time || null,
        status: body.status || "idea",
        tags: body.tags ?? [],
        color: body.color || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("[calendar] Failed to create entry:", error.message);
      return NextResponse.json({ message: "Erreur lors de la creation." }, { status: 500 });
    }

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("[calendar] POST error", error);
    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH  /api/calendar  — Update an entry
// ---------------------------------------------------------------------------
export async function PATCH(request: Request) {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Non authentifie." }, { status: 401 });
    }

    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ message: "L'id est requis." }, { status: 400 });
    }

    const tenantId = await resolveTenantId(supabase, user.id, body.tenantId);
    if (!tenantId) {
      return NextResponse.json({ message: "Acces tenant indisponible." }, { status: 403 });
    }

    if (await isDemoTenant(tenantId, supabase)) {
      logDemoAccess("calendar_update_blocked", { tenantId, userId: user.id });
      return NextResponse.json(
        { message: "Modification desactivee pour le workspace demo." },
        { status: 403 }
      );
    }

    const serviceClient = createSupabaseServiceClient();

    const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.title !== undefined) updateFields.title = body.title.trim();
    if (body.description !== undefined) updateFields.description = body.description?.trim() || null;
    if (body.platform !== undefined) updateFields.platform = body.platform || null;
    if (body.planned_date !== undefined) updateFields.planned_date = body.planned_date || null;
    if (body.planned_time !== undefined) updateFields.planned_time = body.planned_time || null;
    if (body.status !== undefined) updateFields.status = body.status;
    if (body.tags !== undefined) updateFields.tags = body.tags;
    if (body.color !== undefined) updateFields.color = body.color || null;

    const { data: entry, error } = await serviceClient
      .from("content_calendar")
      .update(updateFields)
      .eq("id", body.id)
      .eq("tenant_id", tenantId)
      .select()
      .single();

    if (error) {
      console.error("[calendar] Failed to update entry:", error.message);
      return NextResponse.json({ message: "Erreur lors de la mise a jour." }, { status: 500 });
    }

    return NextResponse.json({ entry });
  } catch (error) {
    console.error("[calendar] PATCH error", error);
    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE  /api/calendar  — Delete an entry
// ---------------------------------------------------------------------------
export async function DELETE(request: Request) {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Non authentifie." }, { status: 401 });
    }

    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ message: "L'id est requis." }, { status: 400 });
    }

    const tenantId = await resolveTenantId(supabase, user.id, body.tenantId);
    if (!tenantId) {
      return NextResponse.json({ message: "Acces tenant indisponible." }, { status: 403 });
    }

    if (await isDemoTenant(tenantId, supabase)) {
      logDemoAccess("calendar_delete_blocked", { tenantId, userId: user.id });
      return NextResponse.json(
        { message: "Modification desactivee pour le workspace demo." },
        { status: 403 }
      );
    }

    const serviceClient = createSupabaseServiceClient();
    const { error } = await serviceClient
      .from("content_calendar")
      .delete()
      .eq("id", body.id)
      .eq("tenant_id", tenantId);

    if (error) {
      console.error("[calendar] Failed to delete entry:", error.message);
      return NextResponse.json({ message: "Erreur lors de la suppression." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[calendar] DELETE error", error);
    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 });
  }
}
