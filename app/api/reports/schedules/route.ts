import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveActiveTenantId } from "@/lib/auth";
import { isDemoTenant, logDemoAccess } from "@/lib/demo";
import { computeNextSendAt } from "@/lib/report-scheduler";
import { canManageReportSchedules } from "@/lib/tenant-selection";
import type { UserRole } from "@/lib/types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function resolveTenantContext(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
  requestedTenantId?: string | null
): Promise<{ tenantId: string | null; role: UserRole | null }> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,tenant_id,role")
    .eq("id", userId)
    .single();

  const tenantId = profile
    ? await resolveActiveTenantId(profile, requestedTenantId)
    : null;

  return { tenantId, role: profile?.role ?? null };
}

// GET /api/reports/schedules?tenantId=xxx
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId");

    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ message: "Non authentifie." }, { status: 401 });
    }

    const { tenantId } = await resolveTenantContext(supabase, user.id, requestedTenantId);
    if (!tenantId) {
      return NextResponse.json({ message: "Acces tenant indisponible." }, { status: 403 });
    }

    const { data: schedules, error } = await supabase
      .from("report_schedules")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[reports] Failed to fetch schedules:", error.message);
      return NextResponse.json({ message: "Erreur serveur." }, { status: 500 });
    }

    return NextResponse.json({ schedules: schedules ?? [] });
  } catch (error) {
    console.error("[reports] GET error:", error);
    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 });
  }
}

// POST /api/reports/schedules
export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ message: "Non authentifie." }, { status: 401 });
    }

    const body = await request.json();
    const { tenantId, role } = await resolveTenantContext(supabase, user.id, body.tenantId);
    if (!tenantId) {
      return NextResponse.json({ message: "Acces tenant indisponible." }, { status: 403 });
    }
    if (!canManageReportSchedules(role)) {
      return NextResponse.json(
        { message: "Role manager requis pour modifier les rapports automatiques." },
        { status: 403 }
      );
    }

    if (await isDemoTenant(tenantId, supabase)) {
      logDemoAccess("report_schedule_create_blocked", { tenantId, userId: user.id });
      return NextResponse.json(
        { message: "Modification desactivee pour le workspace demo." },
        { status: 403 }
      );
    }

    const frequency = body.frequency === "monthly" ? "monthly" : "weekly";
    const recipients: string[] = Array.isArray(body.recipients) ? body.recipients : [];

    if (recipients.length === 0) {
      return NextResponse.json({ message: "Au moins un destinataire est requis." }, { status: 400 });
    }

    const invalidEmails = recipients.filter((email) => !EMAIL_REGEX.test(email));
    if (invalidEmails.length > 0) {
      return NextResponse.json(
        { message: `Email(s) invalide(s): ${invalidEmails.join(", ")}` },
        { status: 400 }
      );
    }

    const nextSendAt = computeNextSendAt(frequency);

    const { data: schedule, error } = await supabase
      .from("report_schedules")
      .insert({
        tenant_id: tenantId,
        frequency,
        recipients,
        is_active: true,
        next_send_at: nextSendAt,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("[reports] Failed to create schedule:", error.message);
      return NextResponse.json({ message: "Erreur lors de la creation." }, { status: 500 });
    }

    return NextResponse.json({ schedule }, { status: 201 });
  } catch (error) {
    console.error("[reports] POST error:", error);
    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 });
  }
}

// PATCH /api/reports/schedules
export async function PATCH(request: Request) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ message: "Non authentifie." }, { status: 401 });
    }

    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ message: "L'id est requis." }, { status: 400 });
    }

    const { tenantId, role } = await resolveTenantContext(supabase, user.id, body.tenantId);
    if (!tenantId) {
      return NextResponse.json({ message: "Acces tenant indisponible." }, { status: 403 });
    }
    if (!canManageReportSchedules(role)) {
      return NextResponse.json(
        { message: "Role manager requis pour modifier les rapports automatiques." },
        { status: 403 }
      );
    }

    if (await isDemoTenant(tenantId, supabase)) {
      logDemoAccess("report_schedule_update_blocked", { tenantId, userId: user.id });
      return NextResponse.json(
        { message: "Modification desactivee pour le workspace demo." },
        { status: 403 }
      );
    }

    const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.frequency !== undefined) {
      updateFields.frequency = body.frequency === "monthly" ? "monthly" : "weekly";
      updateFields.next_send_at = computeNextSendAt(updateFields.frequency as "weekly" | "monthly");
    }

    if (body.recipients !== undefined) {
      const recipients: string[] = Array.isArray(body.recipients) ? body.recipients : [];
      const invalidEmails = recipients.filter((email) => !EMAIL_REGEX.test(email));
      if (invalidEmails.length > 0) {
        return NextResponse.json(
          { message: `Email(s) invalide(s): ${invalidEmails.join(", ")}` },
          { status: 400 }
        );
      }
      updateFields.recipients = recipients;
    }

    if (body.is_active !== undefined) {
      updateFields.is_active = Boolean(body.is_active);
    }

    const { data: schedule, error } = await supabase
      .from("report_schedules")
      .update(updateFields)
      .eq("id", body.id)
      .eq("tenant_id", tenantId)
      .select()
      .single();

    if (error) {
      console.error("[reports] Failed to update schedule:", error.message);
      return NextResponse.json({ message: "Erreur lors de la mise a jour." }, { status: 500 });
    }

    return NextResponse.json({ schedule });
  } catch (error) {
    console.error("[reports] PATCH error:", error);
    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 });
  }
}

// DELETE /api/reports/schedules
export async function DELETE(request: Request) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ message: "Non authentifie." }, { status: 401 });
    }

    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ message: "L'id est requis." }, { status: 400 });
    }

    const { tenantId, role } = await resolveTenantContext(supabase, user.id, body.tenantId);
    if (!tenantId) {
      return NextResponse.json({ message: "Acces tenant indisponible." }, { status: 403 });
    }
    if (!canManageReportSchedules(role)) {
      return NextResponse.json(
        { message: "Role manager requis pour modifier les rapports automatiques." },
        { status: 403 }
      );
    }

    if (await isDemoTenant(tenantId, supabase)) {
      logDemoAccess("report_schedule_delete_blocked", { tenantId, userId: user.id });
      return NextResponse.json(
        { message: "Modification desactivee pour le workspace demo." },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from("report_schedules")
      .delete()
      .eq("id", body.id)
      .eq("tenant_id", tenantId);

    if (error) {
      console.error("[reports] Failed to delete schedule:", error.message);
      return NextResponse.json({ message: "Erreur lors de la suppression." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[reports] DELETE error:", error);
    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 });
  }
}
