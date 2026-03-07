import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  getSessionProfile,
  requireClientAccess,
  assertTenant,
} from "@/lib/auth";
import { fetchDemographics } from "@/lib/demographics-queries";
import { AgeChart } from "@/components/demographics/age-chart";
import { GenderChart } from "@/components/demographics/gender-chart";
import { LocationChart } from "@/components/demographics/location-chart";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Audience",
};

export default async function DemographicsPage({
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

  const isAdmin =
    profile.role === "agency_admin" && !!searchParams?.tenantId;
  const tenantId = isAdmin
    ? (searchParams?.tenantId ?? "")
    : assertTenant(profile);
  if (!tenantId) {
    redirect("/admin");
  }

  const demographics = await fetchDemographics(tenantId);

  const hasData =
    demographics.age.length > 0 ||
    demographics.gender.length > 0 ||
    demographics.country.length > 0 ||
    demographics.city.length > 0;

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <section className="surface-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="section-label">JumpStart Studio</p>
            <h1 className="page-heading">Audience</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Donnees demographiques de votre audience
            </p>
          </div>
          <div className="flex items-center gap-3">
            {demographics.platforms.length > 0 && (
              <div className="flex items-center gap-1.5">
                {demographics.platforms.map((platform) => (
                  <Badge key={platform} variant="outline" className="text-xs">
                    {platform}
                  </Badge>
                ))}
              </div>
            )}
            {demographics.lastFetchedAt && (
              <p className="text-[11px] text-muted-foreground tabular-nums">
                Mis a jour le{" "}
                {new Date(demographics.lastFetchedAt).toLocaleDateString(
                  "fr-FR",
                  {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                )}
              </p>
            )}
          </div>
        </div>
      </section>

      {!hasData ? (
        <section className="surface-panel p-8">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
              <svg
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-foreground">
              Aucune donnee demographique disponible
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Les donnees seront collectees lors de la prochaine
              synchronisation.
            </p>
          </div>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AgeChart data={demographics.age} />
          <GenderChart data={demographics.gender} />
          <LocationChart
            data={demographics.country}
            title="Pays"
            subtitle="Top pays de votre audience"
            variant="country"
          />
          <LocationChart
            data={demographics.city}
            title="Villes"
            subtitle="Top villes de votre audience"
            variant="city"
          />
        </section>
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";
