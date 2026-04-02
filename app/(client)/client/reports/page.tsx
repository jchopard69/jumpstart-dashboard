import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionProfile, requireClientAccess, resolveActiveTenantId } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ReportScheduleList } from "@/components/reports/report-schedule-list";
import { canManageReportSchedules } from "@/lib/tenant-selection";

export const metadata: Metadata = {
  title: "Rapports automatiques",
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: { tenantId?: string };
}) {
  const profile = await getSessionProfile();
  if (profile.role === "agency_admin") {
    if (!searchParams?.tenantId && !profile.tenant_id) {
      redirect("/admin");
    }
  } else {
    await requireClientAccess(profile);
  }

  const resolvedTenantId = await resolveActiveTenantId(profile, searchParams?.tenantId);
  if (!resolvedTenantId) {
    redirect(profile.role === "agency_admin" ? "/admin" : "/client/dashboard");
  }
  const tenantId = resolvedTenantId;

  const supabase = createSupabaseServerClient();
  const { data: tenantInfo } = await supabase
    .from("tenants")
    .select("is_demo")
    .eq("id", tenantId)
    .maybeSingle();
  const isDemoTenant = Boolean(tenantInfo?.is_demo);
  const canManage = canManageReportSchedules(profile.role);

  const { data: schedules } = await supabase
    .from("report_schedules")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <section className="surface-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="section-label">JumpStart Studio</p>
            <h1 className="page-heading">Rapports automatiques</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Configurez l'envoi automatique de vos rapports PDF par email.
            </p>
          </div>
        </div>
      </section>

      <ReportScheduleList
        initialSchedules={schedules ?? []}
        tenantId={tenantId}
        isDemoTenant={isDemoTenant}
        canManage={canManage}
      />
    </div>
  );
}

export const dynamic = "force-dynamic";
