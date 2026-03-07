import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionProfile, requireClientAccess, assertTenant } from "@/lib/auth";
import { CalendarView } from "@/components/calendar/calendar-view";

export const metadata: Metadata = {
  title: "Calendrier editorial",
};

export default async function CalendarPage({
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

  const isAdmin = profile.role === "agency_admin" && !!searchParams?.tenantId;
  const tenantId = isAdmin ? (searchParams?.tenantId ?? "") : assertTenant(profile);
  if (!tenantId) {
    redirect("/admin");
  }

  const now = new Date();
  const initialMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <section className="surface-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="section-label">JumpStart Studio</p>
            <h1 className="page-heading">Calendrier editorial</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Organisez et planifiez vos publications sur tous vos reseaux.
            </p>
          </div>
        </div>
      </section>

      {/* Calendar client component */}
      <CalendarView tenantId={tenantId} initialMonth={initialMonth} />
    </div>
  );
}

export const dynamic = "force-dynamic";
