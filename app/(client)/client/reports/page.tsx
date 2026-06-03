import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionProfile, requireClientAccess, resolveActiveTenantId } from "@/lib/auth";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { ReportScheduleList } from "@/components/reports/report-schedule-list";
import { canManageReportSchedules } from "@/lib/tenant-selection";
import { ExportButtons } from "@/components/dashboard/export-buttons";

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

  const exportParams = new URLSearchParams({ preset: "last_30_days" });
  if (searchParams?.tenantId) {
    exportParams.set("tenantId", searchParams.tenantId);
  }

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <section className="surface-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="section-label">JumpStart Studio</p>
            <h1 className="page-heading">Rapports automatiques</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Programmez l'envoi email, partagez le PDF stratégique et exportez les données avec recommandations.
            </p>
          </div>
          <ExportButtons query={exportParams.toString()} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="surface-panel p-5">
          <p className="section-label">Dans le PDF</p>
          <h2 className="mt-2 text-base font-semibold">Plan d'actions + opportunités</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Chaque rapport embarque les priorités client, la qualité des données et les opportunités automatiques à activer.
          </p>
        </div>
        <div className="surface-panel p-5">
          <p className="section-label">Dans le CSV</p>
          <h2 className="mt-2 text-base font-semibold">Données actionnables</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            L'export ajoute le taux d'engagement, le statut de fiabilité et une recommandation automatique par ligne.
          </p>
        </div>
        <div className="surface-panel p-5">
          <p className="section-label">Partage</p>
          <h2 className="mt-2 text-base font-semibold">Rythme maîtrisé</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Les managers peuvent choisir un envoi hebdomadaire ou mensuel vers les bons destinataires.
          </p>
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
