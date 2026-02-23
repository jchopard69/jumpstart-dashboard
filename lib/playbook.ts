/**
 * JumpStart Playbook Engine
 *
 * Generates 3 max actionable monthly recommendations from dashboard data.
 * Each recommendation is data-driven with a clear rationale and an OS task template.
 */

import type { Platform } from "./types";
import type { JumpStartScore } from "./scoring";

export type PlaybookAction = {
  id: string;
  title: string;
  description: string;
  rationale: string; // Data point that justifies this recommendation
  priority: "high" | "medium";
  osTask: {
    title: string;
    kind: "idea" | "shoot" | "edit" | "publish" | "next_step" | "monthly_priority";
    priority: "low" | "medium" | "high" | "critical";
    description: string;
  };
};

export type PlaybookInput = {
  totals: {
    followers: number;
    views: number;
    reach: number;
    engagements: number;
    postsCount: number;
  };
  prevTotals: {
    followers: number;
    views: number;
    reach: number;
    engagements: number;
    postsCount: number;
  };
  platforms: Array<{
    platform: Platform;
    totals: { followers: number; views: number; reach: number; engagements: number; posts_count: number };
    delta: { followers: number; views: number; reach: number; engagements: number; posts_count: number };
  }>;
  posts: Array<{
    platform?: Platform;
    media_type?: string;
    posted_at?: string | null;
    metrics?: { impressions?: number; views?: number; engagements?: number; likes?: number; comments?: number; shares?: number } | null;
  }>;
  score?: JumpStartScore;
  periodDays: number;
};

const PLATFORM_NAMES: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn",
  tiktok: "TikTok", youtube: "YouTube", twitter: "X",
};

function normalizeMediaType(type?: string): string {
  if (!type) return "other";
  const lower = type.toLowerCase();
  if (lower.includes("reel")) return "reel";
  if (lower.includes("carousel") || lower.includes("album")) return "carousel";
  if (lower.includes("video")) return "video";
  if (lower.includes("image") || lower.includes("photo")) return "image";
  if (lower.includes("text") || lower.includes("status")) return "text";
  if (lower.includes("link")) return "link";
  return lower;
}

const TYPE_LABELS: Record<string, string> = {
  reel: "Reels", video: "Vidéos", image: "Images",
  carousel: "Carrousels", text: "Publications texte", link: "Liens",
};

/**
 * Generate up to 3 actionable recommendations
 */
export function generatePlaybook(input: PlaybookInput): PlaybookAction[] {
  const candidates: Array<PlaybookAction & { score: number }> = [];

  candidates.push(...checkPostingFrequency(input));
  candidates.push(...checkFormatOptimization(input));
  candidates.push(...checkPlatformBalance(input));
  candidates.push(...checkTimingOptimization(input));
  candidates.push(...checkWeakSubScore(input));
  candidates.push(...checkEngagementRate(input));

  // Sort by score (highest first) and take top 3
  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ score: _score, ...action }) => action);
}

function checkPostingFrequency(input: PlaybookInput): Array<PlaybookAction & { score: number }> {
  const results: Array<PlaybookAction & { score: number }> = [];
  const postsPerWeek = input.periodDays > 0 ? (input.totals.postsCount / input.periodDays) * 7 : 0;

  if (postsPerWeek < 2 && input.periodDays >= 14) {
    results.push({
      id: "frequency-low",
      title: "Augmenter la cadence de publication",
      description: `Vous publiez ${postsPerWeek.toFixed(1)} fois/semaine. Les algorithmes favorisent les comptes actifs — visez au moins 3 publications par semaine.`,
      rationale: `${input.totals.postsCount} publications sur ${input.periodDays} jours (${postsPerWeek.toFixed(1)}/sem.)`,
      priority: "high",
      score: 90,
      osTask: {
        title: "Planifier 3 publications/semaine minimum",
        kind: "monthly_priority",
        priority: "high",
        description: `Objectif : passer de ${postsPerWeek.toFixed(1)} à 3+ publications/semaine. Préparer un calendrier éditorial pour les 4 prochaines semaines.`,
      },
    });
  } else if (postsPerWeek > 10) {
    results.push({
      id: "frequency-high",
      title: "Prioriser la qualité sur la quantité",
      description: `Avec ${postsPerWeek.toFixed(1)} posts/semaine, le risque de fatigue algorithmique est réel. Concentrez-vous sur les formats performants.`,
      rationale: `${postsPerWeek.toFixed(1)} posts/semaine — au-dessus du seuil optimal`,
      priority: "medium",
      score: 50,
      osTask: {
        title: "Réduire à 5-7 posts/semaine, focus qualité",
        kind: "monthly_priority",
        priority: "medium",
        description: "Identifier les 2-3 formats les plus performants et concentrer la production sur ceux-ci.",
      },
    });
  }

  return results;
}

function checkFormatOptimization(input: PlaybookInput): Array<PlaybookAction & { score: number }> {
  const results: Array<PlaybookAction & { score: number }> = [];

  // Group posts by media type
  const byType = new Map<string, { count: number; totalEng: number; totalViews: number }>();
  for (const post of input.posts) {
    const type = normalizeMediaType(post.media_type);
    const existing = byType.get(type) ?? { count: 0, totalEng: 0, totalViews: 0 };
    existing.count++;
    existing.totalEng += post.metrics?.engagements ?? (post.metrics?.likes ?? 0) + (post.metrics?.comments ?? 0);
    existing.totalViews += post.metrics?.impressions ?? post.metrics?.views ?? 0;
    byType.set(type, existing);
  }

  if (byType.size < 2) return results;

  const formats = Array.from(byType.entries())
    .filter(([, data]) => data.count >= 2)
    .map(([type, data]) => ({
      type,
      avgEng: data.totalEng / data.count,
      avgViews: data.totalViews / data.count,
      count: data.count,
      share: data.count / input.posts.length,
    }))
    .sort((a, b) => b.avgEng - a.avgEng);

  if (formats.length < 2) return results;

  const best = formats[0];
  const bestLabel = TYPE_LABELS[best.type] ?? best.type;

  // If best format is underused (< 40% of posts)
  if (best.share < 0.4 && best.avgEng > formats[1].avgEng * 1.3) {
    const ratio = (best.avgEng / formats[1].avgEng).toFixed(1);
    results.push({
      id: "format-optimize",
      title: `Miser davantage sur les ${bestLabel.toLowerCase()}`,
      description: `Les ${bestLabel.toLowerCase()} génèrent ${ratio}x plus d'engagement mais ne représentent que ${Math.round(best.share * 100)}% de vos publications. Augmentez leur part.`,
      rationale: `${bestLabel} : ${Math.round(best.avgEng)} eng. moyen vs ${Math.round(formats[1].avgEng)} pour les ${(TYPE_LABELS[formats[1].type] ?? formats[1].type).toLowerCase()}`,
      priority: "high",
      score: 85,
      osTask: {
        title: `Produire ${Math.max(2, Math.ceil(best.count * 1.5))} ${bestLabel.toLowerCase()} ce mois`,
        kind: "monthly_priority",
        priority: "high",
        description: `Les ${bestLabel.toLowerCase()} sont votre format le plus performant (${ratio}x plus d'engagement). Objectif : passer de ${Math.round(best.share * 100)}% à 50%+ de la production.`,
      },
    });
  }

  return results;
}

function checkPlatformBalance(input: PlaybookInput): Array<PlaybookAction & { score: number }> {
  const results: Array<PlaybookAction & { score: number }> = [];

  const active = input.platforms.filter(p => p.totals.views > 0 || p.totals.engagements > 0);
  if (active.length < 2) return results;

  const withRates = active.map(p => ({
    ...p,
    rate: p.totals.views > 0 ? (p.totals.engagements / p.totals.views) * 100 : 0,
    name: PLATFORM_NAMES[p.platform] ?? p.platform,
  })).sort((a, b) => b.rate - a.rate);

  const best = withRates[0];
  const worst = withRates[withRates.length - 1];

  // Underperforming platform with significant decline
  const declining = input.platforms.find(p => p.delta.engagements < -30 && p.totals.engagements > 0);
  if (declining) {
    const name = PLATFORM_NAMES[declining.platform] ?? declining.platform;
    results.push({
      id: "platform-declining",
      title: `Redresser la performance ${name}`,
      description: `L'engagement sur ${name} a chuté de ${Math.abs(Math.round(declining.delta.engagements))}%. Analysez les dernières publications et adaptez le contenu au format natif de la plateforme.`,
      rationale: `${name} : engagement ${Math.round(declining.delta.engagements)}% vs période précédente`,
      priority: "high",
      score: 75,
      osTask: {
        title: `Audit contenu ${name} + plan de relance`,
        kind: "next_step",
        priority: "high",
        description: `Engagement en baisse de ${Math.abs(Math.round(declining.delta.engagements))}%. Analyser les 10 derniers posts, identifier ce qui ne fonctionne plus, proposer 3 axes d'amélioration.`,
      },
    });
  }

  // Big gap between best and worst platform
  if (best.rate > worst.rate * 3 && worst.rate > 0 && !declining) {
    results.push({
      id: "platform-gap",
      title: `S'inspirer de ${best.name} pour ${worst.name}`,
      description: `${best.name} a un taux d'engagement de ${best.rate.toFixed(1)}% contre ${worst.rate.toFixed(1)}% pour ${worst.name}. Adaptez les contenus gagnants de ${best.name} à ${worst.name}.`,
      rationale: `Écart d'engagement : ${best.name} ${best.rate.toFixed(1)}% vs ${worst.name} ${worst.rate.toFixed(1)}%`,
      priority: "medium",
      score: 60,
      osTask: {
        title: `Adapter le contenu ${best.name} pour ${worst.name}`,
        kind: "idea",
        priority: "medium",
        description: `Reprendre les 3 meilleurs contenus ${best.name} et les adapter au format ${worst.name} (format natif, durée, ton).`,
      },
    });
  }

  return results;
}

function checkTimingOptimization(input: PlaybookInput): Array<PlaybookAction & { score: number }> {
  const results: Array<PlaybookAction & { score: number }> = [];

  const postsWithTime = input.posts.filter(p => p.posted_at);
  if (postsWithTime.length < 5) return results;

  // Group by hour bucket
  const byHour = new Map<number, { count: number; totalEng: number }>();
  for (const post of postsWithTime) {
    const hour = new Date(post.posted_at!).getHours();
    const existing = byHour.get(hour) ?? { count: 0, totalEng: 0 };
    existing.count++;
    existing.totalEng += post.metrics?.engagements ?? (post.metrics?.likes ?? 0);
    byHour.set(hour, existing);
  }

  const hourStats = Array.from(byHour.entries())
    .filter(([, data]) => data.count >= 2)
    .map(([hour, data]) => ({ hour, avgEng: data.totalEng / data.count, count: data.count }))
    .sort((a, b) => b.avgEng - a.avgEng);

  if (hourStats.length < 2) return results;

  const bestWindow = hourStats[0];
  const worstWindow = hourStats[hourStats.length - 1];

  if (bestWindow.avgEng > worstWindow.avgEng * 1.5) {
    const startH = bestWindow.hour;
    const endH = (bestWindow.hour + 2) % 24;
    results.push({
      id: "timing-optimize",
      title: `Publier entre ${startH}h et ${endH}h`,
      description: `Vos publications entre ${startH}h et ${endH}h obtiennent ${Math.round(bestWindow.avgEng)} engagements en moyenne, soit ${((bestWindow.avgEng / worstWindow.avgEng)).toFixed(1)}x plus que les autres créneaux.`,
      rationale: `Créneau ${startH}h-${endH}h : ${Math.round(bestWindow.avgEng)} eng. moyen (${bestWindow.count} posts analysés)`,
      priority: "medium",
      score: 55,
      osTask: {
        title: `Planifier les publications entre ${startH}h-${endH}h`,
        kind: "next_step",
        priority: "medium",
        description: `Le créneau ${startH}h-${endH}h est le plus performant. Paramétrer la programmation des posts sur ce créneau pour le mois prochain.`,
      },
    });
  }

  return results;
}

function checkWeakSubScore(input: PlaybookInput): Array<PlaybookAction & { score: number }> {
  const results: Array<PlaybookAction & { score: number }> = [];
  if (!input.score) return results;

  const weakest = input.score.subScores.reduce((a, b) => a.value < b.value ? a : b);
  if (weakest.value >= 50) return results;

  const actions: Record<string, { title: string; desc: string; task: string }> = {
    growth: {
      title: "Accélérer la croissance d'audience",
      desc: "Votre score de croissance est faible. Investissez dans des contenus de découverte : Reels tendance, collaborations, hashtags stratégiques.",
      task: "Lancer 2 actions de croissance : Reels tendance + collaboration créateur",
    },
    reach: {
      title: "Améliorer la portée organique",
      desc: "Vos contenus n'atteignent pas assez votre audience. Testez des horaires variés, utilisez les formats poussés par les algorithmes.",
      task: "Tester 3 horaires différents + 2 formats natifs par plateforme",
    },
    engagement: {
      title: "Booster les interactions",
      desc: "Le taux d'engagement est sous la moyenne. Intégrez des CTA, posez des questions et créez du contenu qui invite au partage.",
      task: "Ajouter un CTA clair dans chaque publication + 2 posts conversationnels/semaine",
    },
    consistency: {
      title: "Structurer le calendrier éditorial",
      desc: "La régularité de publication est insuffisante. Un calendrier éditorial hebdomadaire apportera plus de visibilité.",
      task: "Créer un calendrier éditorial avec 3+ publications/semaine minimum",
    },
    momentum: {
      title: "Retrouver une dynamique positive",
      desc: "Vos métriques ralentissent. Identifiez les contenus qui fonctionnaient et relancez la machine.",
      task: "Analyser les 5 meilleurs posts du mois dernier et reproduire les formats gagnants",
    },
  };

  const action = actions[weakest.key];
  if (action) {
    results.push({
      id: `subscore-${weakest.key}`,
      title: action.title,
      description: `${action.desc} Score actuel : ${Math.round(weakest.value)}/100.`,
      rationale: `${weakest.label} : ${Math.round(weakest.value)}/100 — votre axe le plus faible`,
      priority: "high",
      score: 80 - weakest.value * 0.5, // Lower score = higher priority
      osTask: {
        title: action.task,
        kind: "monthly_priority",
        priority: "high",
        description: `Axe prioritaire ce mois : ${weakest.label.toLowerCase()} (${Math.round(weakest.value)}/100). ${action.desc}`,
      },
    });
  }

  return results;
}

function checkEngagementRate(input: PlaybookInput): Array<PlaybookAction & { score: number }> {
  const results: Array<PlaybookAction & { score: number }> = [];
  const base = input.totals.views > 0 ? input.totals.views : input.totals.reach;
  if (base <= 0) return results;

  const rate = (input.totals.engagements / base) * 100;

  if (rate < 1 && base > 500) {
    results.push({
      id: "engagement-low",
      title: "Renforcer les appels à l'action",
      description: `Votre taux d'engagement est de ${rate.toFixed(1)}%, sous la moyenne du secteur. Chaque publication devrait contenir un CTA clair invitant à commenter, partager ou sauvegarder.`,
      rationale: `Taux d'engagement : ${rate.toFixed(1)}% (benchmark : 1-3%)`,
      priority: "high",
      score: 70,
      osTask: {
        title: "Intégrer un CTA dans chaque publication",
        kind: "next_step",
        priority: "high",
        description: `Taux d'engagement actuel : ${rate.toFixed(1)}%. Objectif : dépasser 1.5%. Systématiser les CTA : question en fin de caption, sticker sondage en story, incitation au partage.`,
      },
    });
  }

  return results;
}
