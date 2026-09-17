import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionProfile, requireClientAccess, resolveActiveTenantId } from "@/lib/auth";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { ReportScheduleList } from "@/components/reports/report-schedule-list";
import { canManageReportSchedules } from "@/lib/tenant-selection";
import { ExportButtons } from "@/components/dashboard/export-buttons";
import { MonthlyPeriodPicker } from "@/components/review/monthly-period-picker";
import { resolveDateRange, toIsoDate } from "@/lib/date";
import Link from "next/link";


export const metadata: Metadata = {
  title: "Rapports automatiques",
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: { tenantId?: string; from?:string; to?:string };
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

  const isAdminTenantContext = profile.role === "agency_admin" && Boolean(searchParams?.tenantId);
  const supabase = isAdminTenantContext
    ? createSupabaseServiceClient()
    : createSupabaseServerClient();
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
  const range=resolveDateRange(searchParams?.from && searchParams?.to ? "custom":"last_month",searchParams?.from,searchParams?.to);

  const exportParams = new URLSearchParams({ preset: "custom",from:toIsoDate(range.start),to:toIsoDate(range.end) });
  if (searchParams?.tenantId) {
    exportParams.set("tenantId", searchParams.tenantId);
  }

  return <div className="review-app"><header className="review-header"><div className="review-header-top"><div><p className="review-eyebrow">Reporting mensuel</p><h1>Vos rapports<span className="review-title-caption">Le bilan prêt à transmettre à votre direction.</span></h1></div><ExportButtons query={exportParams.toString()}/></div><MonthlyPeriodPicker from={toIsoDate(range.start)} to={toIsoDate(range.end)}/></header><div className="review-panel space-y-8"><section><h2>Envois automatiques</h2><p className="mt-2">Le rapport mensuel couvre le mois terminé et le compare au mois civil précédent. Envoi le 3 dans la matinée (heure de Paris, horaire variable selon la saison et le déclenchement quotidien), aux destinataires configurés disposant encore d’un accès.</p>{profile.role==='agency_admin'&&<Link className="review-text-button mt-4" href="/admin/reports">Gérer l’activation pour les clients →</Link>}</section><ReportScheduleList initialSchedules={schedules??[]} tenantId={tenantId} isDemoTenant={isDemoTenant} canManage={canManage}/></div></div>;
}

export const dynamic = "force-dynamic";
