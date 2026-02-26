import type { Platform } from "@/lib/types";

type SeedPlatform = "instagram" | "facebook" | "linkedin";
type AccountMap = Record<SeedPlatform, string>;

export type DemoMetricRow = {
  tenant_id: string;
  platform: Platform;
  social_account_id: string;
  date: string;
  followers: number;
  impressions: number;
  reach: number;
  engagements: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  views: number;
  watch_time: number;
  posts_count: number;
  raw_json: null;
};

export type DemoPostRow = {
  tenant_id: string;
  platform: Platform;
  social_account_id: string;
  external_post_id: string;
  posted_at: string;
  caption: string;
  media_type: string;
  url: string;
  thumbnail_url: string;
  media_url: string;
  metrics: Record<string, number>;
  raw_json: null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const PLATFORM_CONFIG: Record<
  SeedPlatform,
  {
    followersStart: number;
    growthBase: number;
    growthWave: number;
    impressionsBase: number;
    impressionsTrend: number;
    impressionsWave: number;
    reachRatio: number;
    viewRatio: number;
    engagementBase: number;
    postEvery: number;
    postOffset: number;
  }
> = {
  instagram: {
    followersStart: 8200,
    growthBase: 15,
    growthWave: 8,
    impressionsBase: 14500,
    impressionsTrend: 44,
    impressionsWave: 1500,
    reachRatio: 0.69,
    viewRatio: 0.83,
    engagementBase: 0.047,
    postEvery: 2,
    postOffset: 0,
  },
  facebook: {
    followersStart: 5200,
    growthBase: 6,
    growthWave: 3,
    impressionsBase: 8200,
    impressionsTrend: 22,
    impressionsWave: 860,
    reachRatio: 0.63,
    viewRatio: 0.71,
    engagementBase: 0.034,
    postEvery: 3,
    postOffset: 1,
  },
  linkedin: {
    followersStart: 3100,
    growthBase: 7,
    growthWave: 4,
    impressionsBase: 7600,
    impressionsTrend: 28,
    impressionsWave: 1040,
    reachRatio: 0.58,
    viewRatio: 0.67,
    engagementBase: 0.041,
    postEvery: 4,
    postOffset: 2,
  },
};

const CAPTION_TEMPLATES: Record<SeedPlatform, string[]> = {
  instagram: [
    "Avant/apres de la vitrine du jour: optimisation des couleurs et du cadrage.",
    "Backstage production: captation verticale, hook en 2s, CTA en fin de reel.",
    "Test format carrousel: storytelling en 5 slides + preuve sociale finale.",
    "UGC spotlight: reaction client, benefice concret, conversion en DM.",
    "Routine equipe social: calendrier editoriale, script court, publication cadencee.",
  ],
  facebook: [
    "Bilan de semaine: reach local en hausse et engagement qualitatif en progression.",
    "Focus communaute: question ouverte + call-to-comment pour activer l'algorithme.",
    "Mini etude de cas: campagne locale, ciblage geographique, resultat net.",
    "Point process: validation contenu plus rapide grace au workflow collab.",
    "Annonce planning: publication sponsorisee + relais organique coordonnes.",
  ],
  linkedin: [
    "Insight secteur: les formats educatifs courts performent sur nos audiences B2B.",
    "Retour d'experience: nouvelle ligne editoriale orientee preuve et impact business.",
    "KPIs du mois: visibilite en croissance continue et qualite d'engagement stable.",
    "Playbook contenu: framework hook -> valeur -> preuve -> CTA.",
    "Cas client: optimisation de cadence et de format pour booster la regularite.",
  ],
};

const POST_MEDIA_TYPES: Record<SeedPlatform, string[]> = {
  instagram: ["REEL", "IMAGE", "CAROUSEL_ALBUM"],
  facebook: ["IMAGE", "VIDEO", "LINK"],
  linkedin: ["IMAGE", "ARTICLE", "TEXT"],
};

export function buildDemoDateKeys(days = 90, now = new Date()): string[] {
  const end = new Date(now);
  end.setHours(12, 0, 0, 0);
  const start = new Date(end.getTime() - (days - 1) * DAY_MS);
  const dates: string[] = [];
  for (let i = 0; i < days; i += 1) {
    const day = new Date(start.getTime() + i * DAY_MS);
    dates.push(day.toISOString().slice(0, 10));
  }
  return dates;
}

function seasonal(i: number, period: number, amplitude: number): number {
  return Math.round(Math.sin((2 * Math.PI * i) / period) * amplitude);
}

export function buildDemoMetricsRows(
  tenantId: string,
  accounts: AccountMap,
  dates: string[]
): DemoMetricRow[] {
  const platforms: SeedPlatform[] = ["instagram", "facebook", "linkedin"];
  const rows: DemoMetricRow[] = [];

  for (const platform of platforms) {
    const accountId = accounts[platform];
    const cfg = PLATFORM_CONFIG[platform];
    let followers = cfg.followersStart;

    for (let i = 0; i < dates.length; i += 1) {
      const growth = Math.max(0, cfg.growthBase + seasonal(i, 9, cfg.growthWave));
      followers += growth;

      const impressions = Math.max(
        100,
        Math.round(
          cfg.impressionsBase +
            cfg.impressionsTrend * i +
            seasonal(i, 7, cfg.impressionsWave) +
            (i % 14 === 0 ? cfg.impressionsWave / 3 : 0)
        )
      );
      const reach = Math.round(impressions * cfg.reachRatio);
      const views = Math.round(impressions * cfg.viewRatio);
      const engagementRate = cfg.engagementBase + seasonal(i, 11, 2) / 1000;
      const engagements = Math.max(12, Math.round(views * engagementRate));
      const likes = Math.round(engagements * 0.68);
      const comments = Math.round(engagements * 0.13);
      const shares = Math.round(engagements * 0.11);
      const saves = Math.max(1, engagements - likes - comments - shares);
      const postsCount =
        ((i + cfg.postOffset) % cfg.postEvery === 0 ? 1 : 0) + (i % 28 === 0 ? 1 : 0);

      rows.push({
        tenant_id: tenantId,
        platform,
        social_account_id: accountId,
        date: dates[i],
        followers,
        impressions,
        reach,
        engagements,
        likes,
        comments,
        shares,
        saves,
        views,
        watch_time: Math.round(views * (platform === "instagram" ? 5.2 : platform === "facebook" ? 3.8 : 2.7)),
        posts_count: postsCount,
        raw_json: null,
      });
    }
  }

  return rows;
}

export function buildDemoPostsRows(
  tenantId: string,
  accounts: AccountMap,
  dates: string[]
): DemoPostRow[] {
  const plans: Array<{ platform: SeedPlatform; count: number; spacing: number; hourBase: number }> = [
    { platform: "instagram", count: 16, spacing: 5, hourBase: 11 },
    { platform: "facebook", count: 12, spacing: 7, hourBase: 14 },
    { platform: "linkedin", count: 10, spacing: 8, hourBase: 9 },
  ];

  const rows: DemoPostRow[] = [];
  for (const plan of plans) {
    const captions = CAPTION_TEMPLATES[plan.platform];
    const mediaTypes = POST_MEDIA_TYPES[plan.platform];
    const accountId = accounts[plan.platform];

    for (let i = 0; i < plan.count; i += 1) {
      const idx = Math.max(0, dates.length - 2 - i * plan.spacing);
      const day = dates[idx];
      const hour = (plan.hourBase + (i % 4) * 2) % 24;
      const minute = (i * 11) % 60;
      const postedAt = new Date(`${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`);

      const visibilityBase =
        plan.platform === "instagram" ? 17500 : plan.platform === "facebook" ? 9300 : 7600;
      const visibility = Math.max(
        800,
        Math.round(visibilityBase + (plan.count - i) * 430 + seasonal(i, 5, 620))
      );
      const reach = Math.round(visibility * (plan.platform === "linkedin" ? 0.54 : 0.63));
      const views = Math.round(visibility * (plan.platform === "instagram" ? 0.92 : 0.71));
      const engagements = Math.max(
        25,
        Math.round(views * (plan.platform === "facebook" ? 0.037 : 0.046))
      );
      const likes = Math.round(engagements * 0.69);
      const comments = Math.round(engagements * 0.12);
      const shares = Math.round(engagements * 0.11);
      const saves = Math.max(1, engagements - likes - comments - shares);
      const caption = `${captions[i % captions.length]} #${plan.platform} #jumpstart`;
      const mediaType = mediaTypes[i % mediaTypes.length];
      const safePlatform = plan.platform.charAt(0).toUpperCase() + plan.platform.slice(1);

      rows.push({
        tenant_id: tenantId,
        platform: plan.platform,
        social_account_id: accountId,
        external_post_id: `demo_${plan.platform}_${day.replace(/-/g, "")}_${String(i + 1).padStart(2, "0")}`,
        posted_at: postedAt.toISOString(),
        caption,
        media_type: mediaType,
        url: `https://example.com/demo/${plan.platform}/${i + 1}`,
        thumbnail_url: `https://placehold.co/1200x630/111827/f8fafc?text=${safePlatform}+Demo`,
        media_url: `https://placehold.co/1200x1200/0f172a/f8fafc?text=${safePlatform}+Content`,
        metrics: {
          impressions: visibility,
          reach,
          views,
          engagements,
          likes,
          comments,
          shares,
          saves,
        },
        raw_json: null,
      });
    }
  }

  return rows.sort((a, b) => b.posted_at.localeCompare(a.posted_at));
}

export function buildDemoScoreSnapshots(tenantId: string, today = new Date()) {
  const rows: Array<{
    tenant_id: string;
    snapshot_date: string;
    global_score: number;
    grade: string;
    period_days: number;
    sub_scores: Array<{ label: string; value: number }>;
  }> = [];

  const baseScores = [63, 66, 69, 72, 75, 78];
  const grades = ["B", "B", "B+", "B+", "A-", "A-"];

  for (let i = 0; i < baseScores.length; i += 1) {
    const day = new Date(today.getTime() - (baseScores.length - 1 - i) * 7 * DAY_MS);
    const score = baseScores[i];
    rows.push({
      tenant_id: tenantId,
      snapshot_date: day.toISOString().slice(0, 10),
      global_score: score,
      grade: grades[i],
      period_days: 30,
      sub_scores: [
        { label: "Croissance", value: Math.min(100, score + 6) },
        { label: "Portee", value: Math.min(100, score + 2) },
        { label: "Engagement", value: Math.min(100, score + 4) },
        { label: "Regularite", value: Math.max(0, score - 3) },
        { label: "Momentum", value: Math.min(100, score + 1) },
      ],
    });
  }

  return rows;
}

export function buildDemoShoots(tenantId: string, today = new Date()) {
  const addDays = (count: number) => new Date(today.getTime() + count * DAY_MS).toISOString();
  return [
    {
      tenant_id: tenantId,
      shoot_date: addDays(6),
      location: "Paris 11 - Studio Bastille",
      notes: "Packshot produits + 3 reels behind-the-scenes.",
    },
    {
      tenant_id: tenantId,
      shoot_date: addDays(19),
      location: "Lyon 2 - Concept Store",
      notes: "UGC customer interviews and testimonial capsules.",
    },
    {
      tenant_id: tenantId,
      shoot_date: addDays(34),
      location: "Remote - Creator Session",
      notes: "Batch content for monthly launch campaign.",
    },
  ];
}

export function buildDemoDocuments(tenantId: string) {
  return [
    {
      tenant_id: tenantId,
      file_path: `${tenantId}/demo-brief-q1.pdf`,
      file_name: "Brief strategic Q1",
      tag: "brief",
      pinned: true,
    },
    {
      tenant_id: tenantId,
      file_path: `${tenantId}/demo-content-plan.pdf`,
      file_name: "Content plan 90 days",
      tag: "report",
      pinned: true,
    },
    {
      tenant_id: tenantId,
      file_path: `${tenantId}/demo-brand-guidelines.pdf`,
      file_name: "Brand guidelines",
      tag: "other",
      pinned: false,
    },
  ];
}

export function buildDemoGoals(tenantId: string) {
  return {
    tenant_id: tenantId,
    followers_target: 20000,
    engagement_rate_target: 4.2,
    posts_per_week_target: 5,
    reach_target: 95000,
    views_target: 135000,
    notes: "Objectif demo: croissance durable, regularite et conversion.",
    updated_at: new Date().toISOString(),
  };
}

export function buildDemoCollaboration(tenantId: string) {
  return {
    tenant_id: tenantId,
    shoot_days_remaining: 4,
    notes:
      "Pipeline creatif demo: scripts valides, tournages planifies, post-prod hebdomadaire.",
    updated_at: new Date().toISOString(),
  };
}

export function buildDemoSeedPayload(
  tenantId: string,
  accounts: AccountMap,
  now = new Date()
) {
  const dates = buildDemoDateKeys(90, now);
  return {
    metrics: buildDemoMetricsRows(tenantId, accounts, dates),
    posts: buildDemoPostsRows(tenantId, accounts, dates),
    scoreSnapshots: buildDemoScoreSnapshots(tenantId, now),
    shoots: buildDemoShoots(tenantId, now),
    documents: buildDemoDocuments(tenantId),
    goals: buildDemoGoals(tenantId),
    collaboration: buildDemoCollaboration(tenantId),
  };
}
