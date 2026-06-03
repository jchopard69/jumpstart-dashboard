import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionProfile, requireClientAccess, resolveActiveTenantId } from "@/lib/auth";
import { fetchClientStrategySnapshot } from "@/lib/client-strategy";
import { StrategyOverview } from "@/components/strategy/strategy-overview";

export const metadata: Metadata = {
  title: "Stratégie JumpStart",
};

export default async function ClientStrategyPage({
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

  const tenantId = await resolveActiveTenantId(profile, searchParams?.tenantId);
  if (!tenantId) {
    redirect(profile.role === "agency_admin" ? "/admin" : "/client/dashboard");
  }

  const snapshot = await fetchClientStrategySnapshot({
    tenantId,
    admin: profile.role === "agency_admin",
    includeDraftBriefs: profile.role === "agency_admin",
  });

  return <StrategyOverview snapshot={snapshot} />;
}

export const dynamic = "force-dynamic";
