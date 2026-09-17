import { getPostEngagements, getPostVisibility, hasPostEngagementMeasurement } from "./metrics";

export type EditorialExperiment = {
  week: string;
  title: string;
  evidence: string;
  action: string;
  measure: string;
};

type Post = { platform?: string | null; media_type?: string | null; metrics?: unknown };

/** A test protocol, not a prediction: compare only the same platform and denominator. */
export function buildEditorialRoadmap(posts: Post[], coverage?: number): EditorialExperiment[] {
  const groups = new Map<string, { platform: string; format: string; label: string; rates: number[] }>();
  for (const post of posts) {
    if (!post.platform || !post.media_type) continue;
    if (!hasPostEngagementMeasurement(post.metrics as Record<string, unknown>)) continue;
    const visibility = getPostVisibility(post.metrics as Record<string, unknown>, post.media_type);
    if (visibility.value < 100) continue;
    const key = `${post.platform}:${post.media_type}:${visibility.label}`;
    const group = groups.get(key) ?? { platform: post.platform, format: post.media_type, label: visibility.label, rates: [] };
    group.rates.push(getPostEngagements(post.metrics as Record<string, unknown>) / visibility.value * 100);
    groups.set(key, group);
  }
  const candidate = [...groups.values()].filter(group => group.rates.length >= 3)
    .sort((a, b) => b.rates.length - a.rates.length)[0];
  const usable = candidate && (coverage === undefined || coverage >= 80);
  const baseline = candidate ? [...candidate.rates].sort((a, b) => a - b) : [];
  const middle = Math.floor(baseline.length / 2);
  const median = baseline.length ? (baseline.length % 2 ? baseline[middle] : (baseline[middle - 1] + baseline[middle]) / 2) : 0;
  const evidence = usable
    ? `${candidate.rates.length} contenus ${candidate.format} sur ${candidate.platform} ; médiane interactions / ${candidate.label.toLowerCase()} : ${median.toFixed(1)}%. Cumul observé, âges des contenus variables.`
    : `${posts.length} contenus examinés. ${coverage !== undefined && coverage < 80 ? "Couverture insuffisante pour prioriser un format." : "Pas de groupe comparable d’au moins trois contenus mesurés."}`;
  return [
    { week: "Semaine 1", title: usable ? "Choisir une hypothèse créative" : "Établir une référence fiable", evidence,
      action: usable ? `Sur ${candidate.platform}, préparer deux variantes ${candidate.format} qui ne changent que l’accroche. Valider l’angle avec le client.` : "Vérifier les données, choisir un canal et relever les résultats de trois contenus comparables sept jours après publication.",
      measure: "Consigner plateforme, format, date, dénominateur et résultats à J+7 dans le bilan de test." },
    { week: "Semaine 2", title: "Tester les deux accroches", evidence: "Une variable modifiée à la fois permet une comparaison plus lisible.",
      action: "Publier les variantes à des créneaux et avec une diffusion comparables. Garder le format, le sujet et l’appel à l’action constants.",
      measure: "Comparer à J+7 les interactions et le ratio avec le même dénominateur ; séparer toute diffusion payante." },
    { week: "Semaine 3", title: "Vérifier que le signal se répète", evidence: "Un contenu isolé peut bénéficier d’un effet de sujet ou de diffusion.",
      action: "Répéter l’accroche la plus prometteuse sur un second sujet. Si le premier test est indécis, conserver les deux variantes.",
      measure: "Rechercher la même direction sur deux tests ; aucune conclusion causale avec cet échantillon." },
    { week: "Semaine 4", title: "Décider du prochain cycle", evidence: "La décision s’appuie sur les tests arrivés à J+7, à périmètre constant.",
      action: "Conserver la variante si le gain se répète sans baisse de visibilité ; sinon prolonger le test. Valider le prochain calendrier avec le client.",
      measure: "Documenter : conserver, ajuster ou abandonner ; résultat observé, volume de contenus et limite de la comparaison." },
  ];
}
