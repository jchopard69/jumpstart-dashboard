/**
 * JumpStart Performance Score
 *
 * Proprietary composite score (0-100) measuring social media performance
 * across 5 dimensions: Growth, Reach, Engagement, Consistency, Momentum.
 *
 * This is a signature metric — comparable over time, across platforms,
 * and between clients.
 */

export type SubScore = {
  label: string;
  key: string;
  value: number; // 0-100
  weight: number;
  description: string;
};

export type JumpStartScore = {
  global: number; // 0-100 weighted composite
  grade: "A+" | "A" | "B+" | "B" | "C+" | "C" | "D";
  subScores: SubScore[];
  summary: string; // One-line human-readable summary
};

export type ScoreInput = {
  // Current period
  followers: number;
  views: number;
  reach: number;
  engagements: number;
  postsCount: number;
  // Previous period
  prevFollowers: number;
  prevViews: number;
  prevReach: number;
  prevEngagements: number;
  prevPostsCount: number;
  // Targets (sensible defaults if not set)
  targetPostsPerMonth?: number;
  targetGrowthPercent?: number;
  // Period info
  periodDays: number;
};

const WEIGHTS = {
  growth: 0.25,
  reach: 0.25,
  engagement: 0.25,
  consistency: 0.15,
  momentum: 0.10,
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Growth sub-score (25%)
 * Measures follower evolution relative to a target growth rate.
 * A 2% monthly growth maps to score 70 (good).
 * A 5%+ monthly growth maps to 100.
 */
function computeGrowthScore(input: ScoreInput): number {
  if (input.prevFollowers <= 0) return 50; // No baseline, neutral score

  const growthPercent =
    ((input.followers - input.prevFollowers) / input.prevFollowers) * 100;

  const targetGrowth = input.targetGrowthPercent ?? 3;
  // Map: 0% → 40, target% → 70, 2×target% → 100, negative → scaled down
  if (growthPercent <= 0) {
    // Decline: map -target to 0, 0 to 40
    return clamp(40 + (growthPercent / targetGrowth) * 40);
  }
  // Positive: map 0 to 40, target to 70, 2×target to 100
  const ratio = growthPercent / targetGrowth;
  return clamp(40 + ratio * 30);
}

/**
 * Reach sub-score (25%)
 * Measures how much of the audience is actually reached.
 * reach / followers ratio, normalized against platform benchmarks.
 * Typical organic reach: 5-15% for Facebook, 20-40% for Instagram.
 * We use 15% as a "good" benchmark.
 */
function computeReachScore(input: ScoreInput): number {
  if (input.followers <= 0) return 50;

  const reachRatio = input.reach / input.followers;
  // Map: 0 → 0, 0.05 → 40, 0.15 → 70, 0.40+ → 100
  if (reachRatio <= 0) return 0;
  if (reachRatio <= 0.05) return clamp((reachRatio / 0.05) * 40);
  if (reachRatio <= 0.15) return clamp(40 + ((reachRatio - 0.05) / 0.10) * 30);
  return clamp(70 + ((reachRatio - 0.15) / 0.25) * 30);
}

/**
 * Engagement sub-score (25%)
 * Measures engagement rate (engagements / views or reach).
 * Benchmarks: 1% = acceptable, 3% = good, 5%+ = excellent.
 */
function computeEngagementScore(input: ScoreInput): number {
  const base = input.views > 0 ? input.views : input.reach;
  if (base <= 0) return 50;

  const engagementRate = (input.engagements / base) * 100;
  // Map: 0% → 0, 1% → 40, 3% → 70, 5%+ → 100
  if (engagementRate <= 0) return 0;
  if (engagementRate <= 1) return clamp((engagementRate / 1) * 40);
  if (engagementRate <= 3) return clamp(40 + ((engagementRate - 1) / 2) * 30);
  return clamp(70 + ((engagementRate - 3) / 2) * 30);
}

/**
 * Consistency sub-score (15%)
 * Measures publication frequency against a target.
 * Default target: 12 posts/month (~3/week).
 */
function computeConsistencyScore(input: ScoreInput): number {
  const targetPerMonth = input.targetPostsPerMonth ?? 12;
  const normalizedTarget = (targetPerMonth / 30) * input.periodDays;

  if (normalizedTarget <= 0) return 50;

  const ratio = input.postsCount / normalizedTarget;
  // Map: 0 → 0, 0.5 → 40, 1.0 → 85, 1.5 → 100
  if (ratio <= 0) return 0;
  if (ratio <= 0.5) return clamp((ratio / 0.5) * 40);
  if (ratio <= 1.0) return clamp(40 + ((ratio - 0.5) / 0.5) * 45);
  return clamp(85 + ((ratio - 1.0) / 0.5) * 15);
}

/**
 * Momentum sub-score (10%)
 * Measures the acceleration of key metrics.
 * Positive momentum = performance is improving.
 * Compares current vs previous engagement+reach growth rates.
 */
function computeMomentumScore(input: ScoreInput): number {
  // Engagement momentum
  const engDelta = input.prevEngagements > 0
    ? (input.engagements - input.prevEngagements) / input.prevEngagements
    : 0;

  // Reach momentum
  const reachDelta = input.prevReach > 0
    ? (input.reach - input.prevReach) / input.prevReach
    : 0;

  // View momentum
  const viewsDelta = input.prevViews > 0
    ? (input.views - input.prevViews) / input.prevViews
    : 0;

  // Combined momentum: weighted average of deltas
  const momentum = engDelta * 0.4 + reachDelta * 0.3 + viewsDelta * 0.3;

  // Map: -0.3 → 0, 0 → 50, +0.3 → 100
  return clamp(50 + (momentum / 0.3) * 50);
}

function getGrade(score: number): JumpStartScore["grade"] {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B+";
  if (score >= 60) return "B";
  if (score >= 50) return "C+";
  if (score >= 40) return "C";
  return "D";
}

function generateScoreSummary(score: number, subScores: SubScore[]): string {
  const grade = getGrade(score);
  const best = subScores.reduce((a, b) => (a.value > b.value ? a : b));
  const worst = subScores.reduce((a, b) => (a.value < b.value ? a : b));

  if (grade === "A+" || grade === "A") {
    return `Excellente performance globale. ${best.label} est votre point fort (${Math.round(best.value)}/100).`;
  }
  if (grade === "B+" || grade === "B") {
    return `Bonne dynamique. ${best.label} performe bien, mais ${worst.label.toLowerCase()} peut progresser.`;
  }
  if (grade === "C+" || grade === "C") {
    return `Performance correcte avec des leviers d'amélioration sur ${worst.label.toLowerCase()}.`;
  }
  return `Des axes de progression identifiés, notamment sur ${worst.label.toLowerCase()} et ${best.label.toLowerCase()}.`;
}

/**
 * Compute the JumpStart Performance Score
 */
export function computeJumpStartScore(input: ScoreInput): JumpStartScore {
  const subScores: SubScore[] = [
    {
      label: "Croissance",
      key: "growth",
      value: computeGrowthScore(input),
      weight: WEIGHTS.growth,
      description: "Evolution de votre audience",
    },
    {
      label: "Portee",
      key: "reach",
      value: computeReachScore(input),
      weight: WEIGHTS.reach,
      description: "Part de votre audience atteinte",
    },
    {
      label: "Engagement",
      key: "engagement",
      value: computeEngagementScore(input),
      weight: WEIGHTS.engagement,
      description: "Qualite des interactions",
    },
    {
      label: "Regularite",
      key: "consistency",
      value: computeConsistencyScore(input),
      weight: WEIGHTS.consistency,
      description: "Frequence de publication",
    },
    {
      label: "Momentum",
      key: "momentum",
      value: computeMomentumScore(input),
      weight: WEIGHTS.momentum,
      description: "Acceleration de la performance",
    },
  ];

  const global = Math.round(
    subScores.reduce((sum, s) => sum + s.value * s.weight, 0)
  );

  return {
    global: clamp(global),
    grade: getGrade(global),
    subScores,
    summary: generateScoreSummary(global, subScores),
  };
}

/**
 * Content Impact Score
 * Scores an individual post 0-100 based on relative performance within its cohort.
 */
export type ContentScore = {
  score: number; // 0-100
  tier: "top" | "strong" | "average" | "weak";
};

export function computeContentScore(
  post: { impressions: number; engagements: number; views: number },
  cohort: { maxImpressions: number; maxEngagements: number; maxViews: number; avgImpressions: number; avgEngagements: number }
): ContentScore {
  if (cohort.maxImpressions <= 0 && cohort.maxEngagements <= 0) {
    return { score: 50, tier: "average" };
  }

  // Visibility component (50%): how well did this post reach people?
  const visBase = cohort.maxImpressions || cohort.maxViews || 1;
  const visRatio = Math.max(post.impressions, post.views) / visBase;

  // Engagement component (40%): how much interaction relative to cohort?
  const engBase = cohort.maxEngagements || 1;
  const engRatio = post.engagements / engBase;

  // Efficiency component (10%): engagement rate relative to visibility
  const postReach = post.impressions || post.views || 1;
  const postRate = post.engagements / postReach;
  const avgRate = cohort.avgImpressions > 0
    ? cohort.avgEngagements / cohort.avgImpressions
    : 0.02;
  const effRatio = avgRate > 0 ? Math.min(postRate / avgRate, 2) / 2 : 0.5;

  const raw = visRatio * 50 + engRatio * 40 + effRatio * 10;
  const score = clamp(Math.round(raw * 100) / 100);

  let tier: ContentScore["tier"];
  if (score >= 75) tier = "top";
  else if (score >= 50) tier = "strong";
  else if (score >= 25) tier = "average";
  else tier = "weak";

  return { score: Math.round(score), tier };
}
