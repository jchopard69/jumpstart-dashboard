/**
 * JumpStart Strategic Insights Engine
 *
 * Transforms raw metrics into actionable intelligence.
 * Generates contextual insights, recommendations, and executive summaries.
 */

import type { Platform } from "./types";
import type { JumpStartScore } from "./scoring";
import { computeEngagementRate } from "./metrics";

export type InsightType = "positive" | "negative" | "neutral" | "warning" | "opportunity" | "recommendation";

export type StrategicInsight = {
  type: InsightType;
  category: "growth" | "engagement" | "content" | "platform" | "timing" | "summary";
  title: string;
  description: string;
  priority: number; // 1 = highest
};

export type InsightsInput = {
  // Aggregated totals
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
  // Per-platform data
  platforms: Array<{
    platform: Platform;
    totals: { followers: number; views: number; reach: number; engagements: number; posts_count: number };
    delta: { followers: number; views: number; reach: number; engagements: number; posts_count: number };
  }>;
  // Posts data
  posts: Array<{
    platform?: Platform;
    media_type?: string;
    posted_at?: string | null;
    metrics?: { impressions?: number; views?: number; engagements?: number; likes?: number; comments?: number; shares?: number } | null;
  }>;
  // Score
  score?: JumpStartScore;
  // Period
  periodDays: number;
};

/**
 * Generate all strategic insights from dashboard data
 */
export function generateStrategicInsights(input: InsightsInput): StrategicInsight[] {
  const insights: StrategicInsight[] = [];

  insights.push(...analyzeGrowth(input));
  insights.push(...analyzeEngagement(input));
  insights.push(...analyzeCrossPlatform(input));
  insights.push(...analyzeConsistency(input));
  insights.push(...generateRecommendations(input));

  // Sort by priority, take top insights
  return insights
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 8);
}

/**
 * Generate a one-paragraph executive summary
 */
export function generateExecutiveSummary(input: InsightsInput): string {
  const { totals, prevTotals } = input;
  if (![totals.followers, totals.views, totals.reach, totals.engagements, totals.postsCount].some(value => value > 0)) {
    return "Aucune donnée exploitable sur cette période. Vérifiez la collecte avant de conclure sur la performance.";
  }
  const parts: string[] = [];
  if (prevTotals.followers > 0 && totals.followers > 0) {
    const change = (totals.followers - prevTotals.followers) / prevTotals.followers * 100;
    parts.push(`Audience : ${change >= 0 ? "+" : ""}${change.toFixed(1)}% par rapport à la période précédente.`);
  } else {
    parts.push("Évolution de l'audience non interprétable sans deux relevés exploitables.");
  }
  if (prevTotals.engagements > 0) {
    const change = (totals.engagements - prevTotals.engagements) / prevTotals.engagements * 100;
    parts.push(`Interactions : ${change >= 0 ? "+" : ""}${change.toFixed(1)}% sur les données collectées.`);
  } else {
    parts.push("Pas de référence exploitable pour comparer les interactions.");
  }
  parts.push(`${totals.postsCount} publications sur ${input.periodDays} jours. Les variations doivent être relues à couverture et périmètre comparables.`);
  return parts.join(" ");
}

/**
 * Generate 3 key takeaways for the "Ce qu'il faut retenir" section
 */
export function generateKeyTakeaways(input: InsightsInput): string[] {
  const takeaways: Array<{ text: string; priority: number }> = [];
  const { totals, prevTotals } = input;

  // Follower trend
  const fDelta = prevTotals.followers > 0
    ? ((totals.followers - prevTotals.followers) / prevTotals.followers) * 100
    : 0;
  if (Math.abs(fDelta) > 3) {
    takeaways.push({
      text: fDelta > 0
        ? `Audience en croissance : +${Math.round(fDelta)}% sur la période`
        : `Audience en baisse : ${Math.round(fDelta)}% sur la période`,
      priority: 1,
    });
  }

  // Engagement rate
  const engRate = computeEngagementRate(totals.engagements, totals.views, totals.reach) ?? 0;
  if (engRate > 0) {
    const denominator = totals.views > 0 ? "vues" : "portée cumulée";
    takeaways.push({
      text: `Interactions / ${denominator} : ${engRate.toFixed(1)}% (ratio descriptif)`,
      priority: 2,
    });
  }

  // Posts frequency
  const postsPerWeek = input.periodDays > 0 ? (totals.postsCount / input.periodDays) * 7 : 0;
  if (totals.postsCount > 0) {
    takeaways.push({
      text: `${totals.postsCount} publications sur la période (${postsPerWeek.toFixed(1)}/semaine)`,
      priority: 3,
    });
  }

  // Best platform
  const bestPlat = input.platforms
    .filter(p => p.totals.engagements > 0 || p.totals.views > 0)
    .sort((a, b) => b.totals.engagements - a.totals.engagements)[0];
  if (bestPlat) {
    const names: Record<string, string> = {
      instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn",
      tiktok: "TikTok", youtube: "YouTube", twitter: "X"
    };
    takeaways.push({
      text: `Premier contributeur aux interactions : ${names[bestPlat.platform] ?? bestPlat.platform}`,
      priority: 4,
    });
  }

  return takeaways
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3)
    .map(t => t.text);
}

// --- Internal analysis functions ---

function analyzeGrowth(input: InsightsInput): StrategicInsight[] {
  const results: StrategicInsight[] = [];
  const { totals, prevTotals } = input;

  const followersDelta = prevTotals.followers > 0
    ? ((totals.followers - prevTotals.followers) / prevTotals.followers) * 100
    : 0;

  if (followersDelta > 15) {
    results.push({
      type: "positive", category: "growth", priority: 1,
      title: "Forte croissance d'audience",
      description: `+${Math.round(followersDelta)}% d'abonnés sur la période. Identifiez les contenus qui ont attiré ces nouveaux abonnés et reproduisez la formule.`,
    });
  } else if (followersDelta < -5) {
    results.push({
      type: "negative", category: "growth", priority: 1,
      title: "Baisse d'audience détectée",
      description: `${Math.round(followersDelta)}% d'abonnés. Vérifiez la fréquence de publication et la pertinence des contenus récents.`,
    });
  }

  return results;
}

function analyzeEngagement(input: InsightsInput): StrategicInsight[] {
  const results: StrategicInsight[] = [];
  const { totals, prevTotals } = input;

  const currentRate = computeEngagementRate(totals.engagements, totals.views, totals.reach) ?? 0;
  const prevRate = computeEngagementRate(prevTotals.engagements, prevTotals.views, prevTotals.reach) ?? 0;
  const rateDelta = prevRate > 0 ? ((currentRate - prevRate) / prevRate) * 100 : 0;

  if (currentRate > 5) {
    results.push({
      type: "positive", category: "engagement", priority: 2,
      title: "Ratio d’interactions observé",
      description: `${currentRate.toFixed(1)}% sur les données collectées. Ce ratio dépend du dénominateur et des plateformes ; comparez-le à votre propre historique.`,
    });
  } else if (currentRate < 1 && totals.views > 100) {
    results.push({
      type: "warning", category: "engagement", priority: 2,
      title: "Engagement à renforcer",
      description: `Taux de ${currentRate.toFixed(1)}%. Testez plus d'appels à l'action, de questions ouvertes et de formats interactifs (sondages, carrousels).`,
    });
  }

  if (rateDelta < -25 && prevRate > 1) {
    results.push({
      type: "negative", category: "engagement", priority: 2,
      title: "Chute du taux d'engagement",
      description: `Le taux d'engagement a baissé de ${Math.abs(Math.round(rateDelta))}% vs la période précédente. Analysez les changements de contenu ou de fréquence.`,
    });
  }

  return results;
}

function analyzeCrossPlatform(input: InsightsInput): StrategicInsight[] {
  const results: StrategicInsight[] = [];

  const activePlatforms = input.platforms.filter(
    p => p.totals.views > 0 || p.totals.engagements > 0
  );

  if (activePlatforms.length < 2) return results;

  // Find best engagement rate platform
  const withRates = activePlatforms.map(p => ({
    ...p,
    rate: computeEngagementRate(p.totals.engagements, p.totals.views, p.totals.reach) ?? 0,
  })).sort((a, b) => b.rate - a.rate);

  const best = withRates[0];
  const worst = withRates[withRates.length - 1];

  const names: Record<string, string> = {
    instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn",
    tiktok: "TikTok", youtube: "YouTube", twitter: "X"
  };

  if (best.totals.views > 0 && worst.totals.views > 0 && best.rate > worst.rate * 2 && worst.rate > 0) {
    results.push({
      type: "opportunity", category: "platform", priority: 4,
      title: `${names[best.platform] ?? best.platform} surperforme`,
      description: `Taux d'engagement de ${best.rate.toFixed(1)}% vs ${worst.rate.toFixed(1)}% sur ${names[worst.platform] ?? worst.platform}. Ces ratios ne prouvent pas la supériorité d’un canal : les audiences et définitions diffèrent.`,
    });
  }

  // Detect underperforming platform with declining metrics
  for (const p of input.platforms) {
    if (p.delta.engagements < -30 && p.totals.engagements > 0) {
      results.push({
        type: "warning", category: "platform", priority: 3,
        title: `${names[p.platform] ?? p.platform} : baisse significative`,
        description: `L'engagement a chuté de ${Math.abs(Math.round(p.delta.engagements))}% sur ${names[p.platform] ?? p.platform}. Revoyez la stratégie de contenu sur cette plateforme.`,
      });
    }
  }

  return results;
}

function analyzeConsistency(input: InsightsInput): StrategicInsight[] {
  const results: StrategicInsight[] = [];
  const postsPerWeek = input.periodDays > 0
    ? (input.totals.postsCount / input.periodDays) * 7
    : 0;

  if (postsPerWeek < 1 && input.periodDays > 14) {
    results.push({
      type: "warning", category: "content", priority: 3,
      title: "Fréquence de publication faible",
      description: `${postsPerWeek.toFixed(1)} post/semaine. Validez une cadence soutenable avec le client et mesurez son effet pendant quatre semaines.`,
    });
  } else if (postsPerWeek > 10) {
    results.push({
      type: "neutral", category: "content", priority: 5,
      title: "Volume de publication élevé",
      description: `${postsPerWeek.toFixed(1)} posts/semaine. Vérifiez que la qualité reste constante — parfois moins c'est mieux.`,
    });
  }

  return results;
}

function generateRecommendations(input: InsightsInput): StrategicInsight[] {
  const results: StrategicInsight[] = [];

  // Recommend based on score sub-scores if available
  if (input.score?.subScores.length) {
    const weakest = input.score.subScores.reduce((a, b) => a.value < b.value ? a : b);

    const recs: Record<string, string> = {
      growth: "Investissez dans des contenus de découverte (Reels, hashtags tendance) pour accélérer la croissance d'audience.",
      reach: "Testez deux horaires à format comparable et comparez les résultats après sept jours.",
      engagement: "Intégrez plus d'appels à l'action, posez des questions et créez du contenu qui suscite le débat.",
      consistency: "Fixez une cadence compatible avec les moyens de production, puis mesurez-la pendant quatre semaines.",
      momentum: "Analysez ce qui a changé récemment et revenez aux formats qui fonctionnaient.",
    };

    if (weakest.value < 50) {
      results.push({
        type: "recommendation", category: "summary", priority: 6,
        title: `Axe d'amélioration : ${weakest.label.toLowerCase()}`,
        description: recs[weakest.key] ?? "Concentrez vos efforts sur cet axe pour améliorer votre score global.",
      });
    }
  }

  return results;
}
