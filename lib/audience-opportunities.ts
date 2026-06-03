export type AudienceDemographicEntry = {
  dimension: string;
  value: string;
  percentage: number;
  count?: number | null;
};

export type AudienceDemographicsInput = {
  age: AudienceDemographicEntry[];
  gender: AudienceDemographicEntry[];
  country: AudienceDemographicEntry[];
  city: AudienceDemographicEntry[];
  function: AudienceDemographicEntry[];
  seniority: AudienceDemographicEntry[];
  industry: AudienceDemographicEntry[];
};

export type AudienceOpportunity = {
  id: string;
  title: string;
  action: string;
  automation: string;
  evidence: string;
  confidence: "Haute" | "Moyenne";
};

const GENDER_LABELS: Record<string, string> = {
  male: "Hommes",
  M: "Hommes",
  female: "Femmes",
  F: "Femmes",
  undisclosed: "Autre",
  U: "Autre",
};

function topEntry(entries: AudienceDemographicEntry[]): AudienceDemographicEntry | null {
  return entries.length > 0 ? entries[0] : null;
}

function formatSegment(value?: string | null): string {
  if (!value) return "-";
  return GENDER_LABELS[value] ?? GENDER_LABELS[value.toLowerCase()] ?? value;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}

function confidenceFor(percentage: number, threshold: number): "Haute" | "Moyenne" {
  return percentage >= threshold ? "Haute" : "Moyenne";
}

export function buildAudienceOpportunities(
  demographics: AudienceDemographicsInput
): AudienceOpportunity[] {
  const opportunities: AudienceOpportunity[] = [];
  const primaryAge = topEntry(demographics.age);
  const primaryCity = topEntry(demographics.city);
  const primaryCountry = topEntry(demographics.country);
  const primaryGender = topEntry(demographics.gender);
  const primaryFunction = topEntry(demographics.function);
  const primaryIndustry = topEntry(demographics.industry);
  const dimensionsAvailable = [
    demographics.age.length > 0,
    demographics.gender.length > 0,
    demographics.country.length > 0,
    demographics.city.length > 0,
    demographics.function.length > 0,
    demographics.seniority.length > 0,
    demographics.industry.length > 0,
  ].filter(Boolean).length;

  if (primaryAge && primaryAge.percentage >= 20) {
    opportunities.push({
      id: "audience-core-angle",
      title: `Adapter le calendrier au segment ${formatSegment(primaryAge.value)}`,
      action: "Prioriser 2 formats récurrents qui parlent directement à ce noyau d'audience.",
      automation: "Le dashboard peut générer automatiquement des angles de briefs selon le segment dominant.",
      evidence: `${formatPercent(primaryAge.percentage)} de l'audience identifiée`,
      confidence: confidenceFor(primaryAge.percentage, 35),
    });
  }

  const location = primaryCity ?? primaryCountry;
  if (location && location.percentage >= 15) {
    opportunities.push({
      id: "localize-content-plan",
      title: `Localiser les messages autour de ${formatSegment(location.value)}`,
      action: "Tester des horaires, exemples, lieux et accroches adaptés à cette zone prioritaire.",
      automation: "Déclencher une recommandation de créneau et de wording local lors de la préparation éditoriale.",
      evidence: `${formatPercent(location.percentage)} concentrés sur cette zone`,
      confidence: confidenceFor(location.percentage, 30),
    });
  }

  if (primaryFunction || primaryIndustry) {
    const businessSegment = primaryFunction ?? primaryIndustry;
    opportunities.push({
      id: "professional-segment-brief",
      title: `Créer un angle métier pour ${formatSegment(businessSegment?.value)}`,
      action: "Produire un contenu orienté cas d'usage, preuve ou problématique métier.",
      automation: "Transformer les segments LinkedIn en suggestions de posts B2B et questions d'interview.",
      evidence: businessSegment
        ? `${formatPercent(businessSegment.percentage)} sur le segment dominant`
        : "Segment professionnel détecté",
      confidence: businessSegment && businessSegment.percentage >= 25 ? "Haute" : "Moyenne",
    });
  }

  if (primaryGender && primaryGender.percentage >= 60) {
    opportunities.push({
      id: "gender-balance-test",
      title: `Tester une variante pour l'audience ${formatSegment(primaryGender.value).toLowerCase()}`,
      action: "Comparer une accroche ciblée avec une accroche plus inclusive sur deux publications proches.",
      automation: "Suivre automatiquement le différentiel d'engagement par segment lors des prochaines synchronisations.",
      evidence: `${formatPercent(primaryGender.percentage)} du segment genre`,
      confidence: confidenceFor(primaryGender.percentage, 70),
    });
  }

  if (dimensionsAvailable < 4) {
    opportunities.push({
      id: "improve-audience-coverage",
      title: "Renforcer la lecture audience",
      action: "Vérifier les permissions et pousser la collecte sur les plateformes qui exposent les segments.",
      automation: "Afficher une alerte quand la donnée audience devient trop partielle pour guider les décisions.",
      evidence: `${dimensionsAvailable}/7 dimensions disponibles`,
      confidence: "Moyenne",
    });
  }

  return opportunities.slice(0, 4);
}
