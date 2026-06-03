import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  getSessionProfile,
  requireClientAccess,
  resolveActiveTenantId,
} from "@/lib/auth";
import { fetchDemographics } from "@/lib/demographics-queries";
import { AgeChart } from "@/components/demographics/age-chart";
import { GenderChart } from "@/components/demographics/gender-chart";
import { LocationChart } from "@/components/demographics/location-chart";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_LABELS, type Platform } from "@/lib/types";

export const metadata: Metadata = {
  title: "Audience",
};

function formatPercent(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${Math.round(value * 10) / 10}%`;
}

function formatSegmentValue(value?: string | null): string {
  if (!value) return "-";
  const genderLabels: Record<string, string> = {
    male: "Hommes",
    M: "Hommes",
    female: "Femmes",
    F: "Femmes",
    undisclosed: "Autre",
    U: "Autre",
  };
  return genderLabels[value] ?? genderLabels[value.toLowerCase()] ?? value;
}

function topEntry(entries: Array<{ value: string; percentage: number }>) {
  return entries.length > 0 ? entries[0] : null;
}

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

  const resolvedTenantId = await resolveActiveTenantId(profile, searchParams?.tenantId);
  if (!resolvedTenantId) {
    redirect(profile.role === "agency_admin" ? "/admin" : "/client/dashboard");
  }
  const tenantId = resolvedTenantId;

  const demographics = await fetchDemographics(tenantId);

  const hasData =
    demographics.age.length > 0 ||
    demographics.gender.length > 0 ||
    demographics.country.length > 0 ||
    demographics.city.length > 0 ||
    demographics.function.length > 0 ||
    demographics.seniority.length > 0 ||
    demographics.industry.length > 0;
  const dimensionsAvailable = [
    demographics.age.length > 0,
    demographics.gender.length > 0,
    demographics.country.length > 0,
    demographics.city.length > 0,
    demographics.function.length > 0,
    demographics.seniority.length > 0,
    demographics.industry.length > 0,
  ].filter(Boolean).length;
  const primaryAge = topEntry(demographics.age);
  const primaryGender = topEntry(demographics.gender);
  const primaryCountry = topEntry(demographics.country);
  const primaryCity = topEntry(demographics.city);
  const primaryFunction = topEntry(demographics.function);
  const primaryIndustry = topEntry(demographics.industry);
  const lastFetchedLabel = demographics.lastFetchedAt
    ? new Date(demographics.lastFetchedAt).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <section className="surface-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="section-label">JumpStart Studio</p>
            <h1 className="page-heading">Audience</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Lecture exploitable des segments qui composent votre communauté.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {demographics.platforms.length > 0 && (
              <div className="flex items-center gap-1.5">
                {demographics.platforms.map((platform) => (
                  <Badge key={platform} variant="outline" className="text-xs">
                    {PLATFORM_LABELS[platform as Platform] ?? platform}
                  </Badge>
                ))}
              </div>
            )}
            {lastFetchedLabel && (
              <p className="text-[11px] text-muted-foreground tabular-nums">
                Mis à jour le {lastFetchedLabel}
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
              Aucune donnée démographique disponible
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Les données seront collectées lors d'une prochaine synchronisation compatible. Instagram et LinkedIn
              peuvent exposer ces informations selon les permissions et les volumes disponibles.
            </p>
            <div className="mt-6 grid max-w-2xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
              <div className="rounded-xl border border-border/60 p-4">
                <p className="text-sm font-medium">1. Vérifier les comptes</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Assurez-vous que les comptes sociaux sont connectés.</p>
              </div>
              <div className="rounded-xl border border-border/60 p-4">
                <p className="text-sm font-medium">2. Relancer la sync</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">La collecte audience s'exécute après la synchronisation.</p>
              </div>
              <div className="rounded-xl border border-border/60 p-4">
                <p className="text-sm font-medium">3. Exploiter les segments</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Adaptez formats, messages et ciblage dès que les segments remontent.</p>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="surface-panel p-5">
              <p className="section-label">Segment dominant</p>
              <h2 className="mt-2 text-lg font-semibold">
                {primaryAge ? `${formatSegmentValue(primaryAge.value)} · ${formatPercent(primaryAge.percentage)}` : "Âge non disponible"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Utilisez ce noyau d'audience pour cadrer le ton, les références et les formats éditoriaux.
              </p>
            </div>
            <div className="surface-panel p-5">
              <p className="section-label">Géographie</p>
              <h2 className="mt-2 text-lg font-semibold">
                {primaryCity
                  ? `${formatSegmentValue(primaryCity.value)} · ${formatPercent(primaryCity.percentage)}`
                  : primaryCountry
                    ? `${formatSegmentValue(primaryCountry.value)} · ${formatPercent(primaryCountry.percentage)}`
                    : "Non disponible"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Priorisez les horaires, lieux et messages selon les zones les plus représentées.
              </p>
            </div>
            <div className="surface-panel p-5">
              <p className="section-label">Couverture</p>
              <h2 className="mt-2 text-lg font-semibold">
                {dimensionsAvailable}/7 dimensions
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {lastFetchedLabel ? `Dernière collecte : ${lastFetchedLabel}.` : "Date de collecte indisponible."}
              </p>
            </div>
          </section>

          {(primaryGender || primaryFunction || primaryIndustry) && (
            <section className="surface-panel p-5">
              <p className="section-label">Lecture stratégique</p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                {primaryGender && (
                  <div className="rounded-xl border border-border/60 p-4">
                    <p className="text-sm font-medium">Genre principal</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatSegmentValue(primaryGender.value)} · {formatPercent(primaryGender.percentage)}
                    </p>
                  </div>
                )}
                {primaryFunction && (
                  <div className="rounded-xl border border-border/60 p-4">
                    <p className="text-sm font-medium">Fonction dominante</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatSegmentValue(primaryFunction.value)} · {formatPercent(primaryFunction.percentage)}
                    </p>
                  </div>
                )}
                {primaryIndustry && (
                  <div className="rounded-xl border border-border/60 p-4">
                    <p className="text-sm font-medium">Secteur dominant</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatSegmentValue(primaryIndustry.value)} · {formatPercent(primaryIndustry.percentage)}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {demographics.age.length > 0 && <AgeChart data={demographics.age} />}
            {demographics.gender.length > 0 && <GenderChart data={demographics.gender} />}
            {demographics.country.length > 0 && (
              <LocationChart
                data={demographics.country}
                title="Pays"
                subtitle="Top pays de votre audience"
                variant="country"
              />
            )}
            {demographics.city.length > 0 && (
              <LocationChart
                data={demographics.city}
                title="Villes"
                subtitle="Top villes de votre audience"
                variant="city"
              />
            )}
            {demographics.function.length > 0 && (
              <LocationChart
                data={demographics.function}
                title="Fonctions"
                subtitle="Fonctions professionnelles de votre audience"
                variant="city"
              />
            )}
            {demographics.seniority.length > 0 && (
              <LocationChart
                data={demographics.seniority}
                title="Séniorité"
                subtitle="Niveaux d'expérience de votre audience"
                variant="city"
              />
            )}
            {demographics.industry.length > 0 && (
              <LocationChart
                data={demographics.industry}
                title="Secteurs"
                subtitle="Secteurs d'activité de votre audience"
                variant="city"
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";
