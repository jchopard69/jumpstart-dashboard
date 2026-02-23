/**
 * JumpStart Pulse Engine
 *
 * Generates a structured narrative monthly summary.
 * Template-based — no AI, uses existing totals/deltas/score data.
 */

import type { Platform } from "./types";
import type { JumpStartScore } from "./scoring";

export type PulseSection = {
  id: string;
  label: string;
  emoji: string;
  text: string;
};

export type PulseResult = {
  headline: string;
  sections: PulseSection[];
};

export type PulseInput = {
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
  score: JumpStartScore;
  prevScore?: number | null; // Previous period global score
  periodDays: number;
};

const PLATFORM_NAMES: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn",
  tiktok: "TikTok", youtube: "YouTube", twitter: "X",
};

function pct(current: number, previous: number): number {
  if (previous <= 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
}

function fmtDelta(value: number): string {
  return value >= 0 ? `+${value}%` : `${value}%`;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("fr-FR");
}

/**
 * Generate the Pulse narrative summary
 */
export function generatePulse(input: PulseInput): PulseResult {
  const sections: PulseSection[] = [];

  // 1. Score evolution
  sections.push(buildScoreSection(input));

  // 2. Main growth driver
  const driver = buildDriverSection(input);
  if (driver) sections.push(driver);

  // 3. Key metric highlight
  sections.push(buildHighlightSection(input));

  // 4. Point of attention
  const attention = buildAttentionSection(input);
  if (attention) sections.push(attention);

  // 5. One recommendation
  sections.push(buildRecommendation(input));

  // Build headline
  const headline = buildHeadline(input);

  return { headline, sections };
}

function buildHeadline(input: PulseInput): string {
  const { score } = input;
  const followersDelta = pct(input.totals.followers, input.prevTotals.followers);
  const engDelta = pct(input.totals.engagements, input.prevTotals.engagements);

  if (score.global >= 80) {
    return "Excellente période — la dynamique est très positive.";
  }
  if (score.global >= 60 && (followersDelta > 0 || engDelta > 0)) {
    return "Bonne dynamique avec des axes de progression identifiés.";
  }
  if (score.global >= 60) {
    return "Performance solide, quelques ajustements à prévoir.";
  }
  if (followersDelta < -5 || engDelta < -20) {
    return "Période de transition — des actions correctives sont recommandées.";
  }
  return "Des leviers d'amélioration clairs pour le mois prochain.";
}

function buildScoreSection(input: PulseInput): PulseSection {
  const { score, prevScore } = input;
  let text = `Score JumpStart : ${score.global}/100 (${score.grade}).`;

  if (prevScore != null && prevScore > 0) {
    const delta = score.global - prevScore;
    if (delta > 0) {
      text += ` En hausse de ${delta} points par rapport à la période précédente.`;
    } else if (delta < 0) {
      text += ` En baisse de ${Math.abs(delta)} points par rapport à la période précédente.`;
    } else {
      text += " Stable par rapport à la période précédente.";
    }
  }

  return { id: "score", label: "Score", emoji: "📊", text };
}

function buildDriverSection(input: PulseInput): PulseSection | null {
  const active = input.platforms.filter(p =>
    p.totals.views > 0 || p.totals.engagements > 0
  );
  if (active.length === 0) return null;

  // Find platform with highest engagement contribution
  const totalEng = active.reduce((sum, p) => sum + p.totals.engagements, 0);
  const sorted = [...active].sort((a, b) => b.totals.engagements - a.totals.engagements);
  const leader = sorted[0];
  const name = PLATFORM_NAMES[leader.platform] ?? leader.platform;
  const share = totalEng > 0 ? Math.round((leader.totals.engagements / totalEng) * 100) : 0;

  const followersDelta = pct(input.totals.followers, input.prevTotals.followers);

  let text = `${name} mène la performance avec ${share}% des interactions totales.`;
  if (followersDelta > 5) {
    text += ` L'audience progresse de ${fmtDelta(followersDelta)} — la stratégie de croissance porte ses fruits.`;
  } else if (followersDelta < -3) {
    text += ` L'audience est cependant en recul (${fmtDelta(followersDelta)}).`;
  }

  return { id: "driver", label: "Moteur", emoji: "🚀", text };
}

function buildHighlightSection(input: PulseInput): PulseSection {
  const { totals, prevTotals } = input;

  // Find the most impressive metric change
  const metrics = [
    { key: "views", label: "vues", current: totals.views, prev: prevTotals.views },
    { key: "reach", label: "portée", current: totals.reach, prev: prevTotals.reach },
    { key: "engagements", label: "engagements", current: totals.engagements, prev: prevTotals.engagements },
  ].filter(m => m.current > 0);

  const withDelta = metrics.map(m => ({
    ...m,
    delta: pct(m.current, m.prev),
  })).sort((a, b) => b.delta - a.delta);

  const highlight = withDelta[0];

  if (highlight && Math.abs(highlight.delta) > 5) {
    return {
      id: "highlight",
      label: "Fait marquant",
      emoji: "✨",
      text: highlight.delta > 0
        ? `${fmtNum(highlight.current)} ${highlight.label} (${fmtDelta(highlight.delta)}) — c'est la métrique la plus dynamique de cette période.`
        : `${fmtNum(highlight.current)} ${highlight.label} sur la période. La métrique la plus notable à surveiller.`,
    };
  }

  // Fallback: show total posts
  return {
    id: "highlight",
    label: "Fait marquant",
    emoji: "✨",
    text: `${totals.postsCount} publications sur la période avec ${fmtNum(totals.engagements)} interactions au total.`,
  };
}

function buildAttentionSection(input: PulseInput): PulseSection | null {
  const { score } = input;

  // Find weakest sub-score
  const weakest = score.subScores.reduce((a, b) => a.value < b.value ? a : b);
  if (weakest.value >= 60) return null; // No major concern

  const tips: Record<string, string> = {
    growth: "La croissance d'audience nécessite plus de contenus de découverte et de visibilité.",
    reach: "La portée organique est en deçà du potentiel. Les formats vidéo courts et les horaires optimaux peuvent aider.",
    engagement: "Les interactions sont insuffisantes. Les contenus conversationnels et les CTA clairs font la différence.",
    consistency: "La fréquence de publication est trop irrégulière. Un calendrier éditorial structuré est prioritaire.",
    momentum: "La dynamique ralentit. Il faut relancer avec les formats qui ont prouvé leur efficacité.",
  };

  return {
    id: "attention",
    label: "Point d'attention",
    emoji: "⚠️",
    text: `${weakest.label} (${Math.round(weakest.value)}/100) : ${tips[weakest.key] ?? "Cet axe mérite une attention particulière ce mois-ci."}`,
  };
}

function buildRecommendation(input: PulseInput): PulseSection {
  const { score, totals, prevTotals } = input;

  // Pick the most impactful recommendation based on current state
  const postsPerWeek = input.periodDays > 0 ? (totals.postsCount / input.periodDays) * 7 : 0;
  const engRate = totals.views > 0 ? (totals.engagements / totals.views) * 100 : 0;
  const followersDelta = pct(totals.followers, prevTotals.followers);

  // Priority order of recommendations
  if (postsPerWeek < 2 && input.periodDays >= 14) {
    return {
      id: "recommendation",
      label: "Action prioritaire",
      emoji: "🎯",
      text: "Structurez un calendrier éditorial pour atteindre 3 publications par semaine. La régularité est le premier levier de croissance organique.",
    };
  }

  if (engRate < 1 && totals.views > 500) {
    return {
      id: "recommendation",
      label: "Action prioritaire",
      emoji: "🎯",
      text: "Intégrez un appel à l'action clair dans chaque publication. Questions ouvertes, sondages et contenus participatifs boostent significativement l'engagement.",
    };
  }

  if (followersDelta < -5) {
    return {
      id: "recommendation",
      label: "Action prioritaire",
      emoji: "🎯",
      text: "L'audience recule — concentrez-vous sur des contenus de découverte (Reels, shorts) et des collaborations pour toucher de nouvelles personnes.",
    };
  }

  // Default: focus on weakest sub-score
  const weakest = score.subScores.reduce((a, b) => a.value < b.value ? a : b);
  const recs: Record<string, string> = {
    growth: "Investissez dans 2-3 contenus de découverte cette semaine pour relancer la croissance.",
    reach: "Testez de nouveaux horaires de publication et privilégiez les formats favorisés par les algorithmes.",
    engagement: "Créez 2 contenus conversationnels cette semaine (question, sondage, débat).",
    consistency: "Bloquez 3 créneaux de publication dans votre semaine et tenez-les.",
    momentum: "Reproduisez vos 3 meilleurs formats du mois dernier pour relancer la dynamique.",
  };

  return {
    id: "recommendation",
    label: "Action prioritaire",
    emoji: "🎯",
    text: recs[weakest.key] ?? "Concentrez vos efforts sur le format le plus performant et publiez régulièrement.",
  };
}
