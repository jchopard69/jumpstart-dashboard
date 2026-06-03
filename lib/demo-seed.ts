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

export type DemoDemographicRow = {
  tenant_id: string;
  social_account_id: string;
  platform: Platform;
  dimension: string;
  value: string;
  percentage: number;
  count: number;
  fetched_at: string;
};

export type DemoStrategyProfile = {
  tenant_id: string;
  positioning: string;
  target_audience: string;
  offer_focus: string;
  brand_voice: string;
  editorial_pillars: string;
  current_quarter_objectives: string;
  monthly_focus: string;
  jumpstart_note: string;
  updated_at: string;
};

export type DemoMonthlyStrategyBrief = {
  tenant_id: string;
  period_month: string;
  title: string;
  executive_summary: string;
  wins: string;
  learnings: string;
  next_focus: string;
  client_requests: string;
  jumpstart_actions: string;
  is_published: boolean;
  updated_at: string;
};

export type DemoStrategyActionItem = {
  tenant_id: string;
  title: string;
  rationale: string;
  expected_impact: string;
  owner: "jumpstart" | "client" | "shared";
  status: "recommended" | "planned" | "in_progress" | "done" | "paused";
  priority: "low" | "medium" | "high" | "critical";
  due_date: string;
  sort_order: number;
  updated_at: string;
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
        { label: "Portée", value: Math.min(100, score + 2) },
        { label: "Engagement", value: Math.min(100, score + 4) },
        { label: "Régularité", value: Math.max(0, score - 3) },
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
    notes: "Objectif démo : croissance durable, régularité et conversion.",
    updated_at: new Date().toISOString(),
  };
}

export function buildDemoCollaboration(tenantId: string) {
  return {
    tenant_id: tenantId,
    shoot_days_remaining: 4,
    notes:
      "Pipeline créatif démo : scripts validés, tournages planifiés, post-prod hebdomadaire.",
    updated_at: new Date().toISOString(),
  };
}

function buildDemoDemographicRowsForPlatform(params: {
  tenantId: string;
  socialAccountId: string;
  platform: Platform;
  fetchedAt: string;
  dimensions: Record<string, Array<{ value: string; percentage: number; count: number }>>;
}): DemoDemographicRow[] {
  return Object.entries(params.dimensions).flatMap(([dimension, values]) =>
    values.map((entry) => ({
      tenant_id: params.tenantId,
      social_account_id: params.socialAccountId,
      platform: params.platform,
      dimension,
      value: entry.value,
      percentage: entry.percentage,
      count: entry.count,
      fetched_at: params.fetchedAt,
    }))
  );
}

export function buildDemoDemographicsRows(
  tenantId: string,
  accounts: AccountMap,
  now = new Date()
): DemoDemographicRow[] {
  const fetchedAt = now.toISOString();
  return [
    ...buildDemoDemographicRowsForPlatform({
      tenantId,
      socialAccountId: accounts.instagram,
      platform: "instagram",
      fetchedAt,
      dimensions: {
        age: [
          { value: "18-24", percentage: 16, count: 1800 },
          { value: "25-34", percentage: 42, count: 4725 },
          { value: "35-44", percentage: 24, count: 2700 },
          { value: "45-54", percentage: 12, count: 1350 },
          { value: "55+", percentage: 6, count: 675 },
        ],
        gender: [
          { value: "female", percentage: 57, count: 6412 },
          { value: "male", percentage: 39, count: 4387 },
          { value: "undisclosed", percentage: 4, count: 450 },
        ],
        country: [
          { value: "FR", percentage: 72, count: 8100 },
          { value: "BE", percentage: 8, count: 900 },
          { value: "CH", percentage: 7, count: 787 },
          { value: "CA", percentage: 5, count: 562 },
          { value: "US", percentage: 4, count: 450 },
        ],
        city: [
          { value: "Paris", percentage: 34, count: 3825 },
          { value: "Lyon", percentage: 12, count: 1350 },
          { value: "Bordeaux", percentage: 9, count: 1012 },
          { value: "Marseille", percentage: 8, count: 900 },
          { value: "Nantes", percentage: 6, count: 675 },
        ],
      },
    }),
    ...buildDemoDemographicRowsForPlatform({
      tenantId,
      socialAccountId: accounts.linkedin,
      platform: "linkedin",
      fetchedAt,
      dimensions: {
        function: [
          { value: "Marketing", percentage: 34, count: 1420 },
          { value: "Business Development", percentage: 18, count: 752 },
          { value: "Operations", percentage: 16, count: 668 },
          { value: "Entrepreneurship", percentage: 14, count: 585 },
          { value: "Sales", percentage: 10, count: 418 },
        ],
        seniority: [
          { value: "Manager", percentage: 31, count: 1295 },
          { value: "Director", percentage: 23, count: 961 },
          { value: "Owner", percentage: 19, count: 794 },
          { value: "Senior", percentage: 17, count: 710 },
          { value: "Entry", percentage: 6, count: 251 },
        ],
        industry: [
          { value: "Marketing & Advertising", percentage: 27, count: 1128 },
          { value: "Retail", percentage: 18, count: 752 },
          { value: "Hospitality", percentage: 14, count: 585 },
          { value: "Sports", percentage: 12, count: 501 },
          { value: "Technology", percentage: 10, count: 418 },
        ],
        country: [
          { value: "FR", percentage: 68, count: 2840 },
          { value: "BE", percentage: 9, count: 376 },
          { value: "CH", percentage: 8, count: 334 },
          { value: "GB", percentage: 5, count: 209 },
        ],
      },
    }),
  ];
}

export function buildDemoStrategyProfile(tenantId: string, now = new Date()): DemoStrategyProfile {
  return {
    tenant_id: tenantId,
    positioning:
      "JumpStart accompagne les marques ambitieuses qui veulent transformer leur présence sociale en actif business mesurable.",
    target_audience:
      "Dirigeants de PME, responsables marketing et fondateurs qui cherchent un pilotage clair entre contenu, acquisition et image de marque.",
    offer_focus:
      "Pack Social Performance : production de contenus, dashboard décisionnel, briefs mensuels et plan d'action priorisé.",
    brand_voice:
      "Direct, expert, énergique et orienté preuves. Le ton reste premium sans être froid.",
    editorial_pillars:
      "Preuves client\nFormats pédagogiques courts\nBackstage production\nAnalyse de performance\nOffres et activations commerciales",
    current_quarter_objectives:
      "Augmenter la portée qualifiée\nStabiliser une cadence de 5 posts/semaine\nIdentifier les 3 formats à scaler\nRendre les reportings clients plus actionnables",
    monthly_focus: "Scaler les formats éducatifs courts et convertir les meilleurs contenus en séquences sponsorisées.",
    jumpstart_note:
      "Le compte démo montre un client en phase d'accélération : bonnes bases, données fiables, priorité sur la conversion des contenus forts.",
    updated_at: now.toISOString(),
  };
}

export function buildDemoMonthlyStrategyBrief(
  tenantId: string,
  now = new Date()
): DemoMonthlyStrategyBrief {
  const periodMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  return {
    tenant_id: tenantId,
    period_month: periodMonth,
    title: "Brief mensuel JumpStart - Accélération des formats forts",
    executive_summary:
      "La période confirme une dynamique positive : portée en hausse, engagement stable et formats éducatifs courts au-dessus de la moyenne. Le prochain levier consiste à transformer ces contenus en assets sponsorisés et en séquences éditoriales récurrentes.",
    wins:
      "Les reels pédagogiques captent mieux l'attention.\nLes carrousels preuve sociale génèrent plus d'enregistrements.\nLinkedIn progresse sur les audiences marketing et direction.",
    learnings:
      "Les publications trop généralistes sous-performent.\nLes meilleurs contenus combinent preuve, bénéfice concret et CTA simple.\nLa régularité reste plus importante que le volume isolé.",
    next_focus:
      "Produire 2 séries courtes à partir des meilleurs posts, tester une amplification payante contrôlée et consolider les messages d'offre.",
    client_requests:
      "Valider les 3 angles éditoriaux prioritaires.\nPartager les prochaines dates business importantes.\nPrioriser les offres à pousser ce mois-ci.",
    jumpstart_actions:
      "Préparer la grille éditoriale du mois.\nIsoler les contenus sponsorisables.\nMettre à jour le dashboard avec la lecture stratégique.",
    is_published: true,
    updated_at: now.toISOString(),
  };
}

export function buildDemoStrategyActionItems(
  tenantId: string,
  now = new Date()
): DemoStrategyActionItem[] {
  const dueDate = (days: number) => new Date(now.getTime() + days * DAY_MS).toISOString().slice(0, 10);
  return [
    {
      tenant_id: tenantId,
      title: "Transformer les 3 meilleurs posts en séquence sponsorisée",
      rationale: "Les contenus phares ont déjà prouvé leur traction organique.",
      expected_impact: "Portée qualifiée +15% et meilleur coût d'apprentissage créatif.",
      owner: "jumpstart",
      status: "planned",
      priority: "high",
      due_date: dueDate(7),
      sort_order: 1,
      updated_at: now.toISOString(),
    },
    {
      tenant_id: tenantId,
      title: "Valider les offres à pousser sur le prochain mois",
      rationale: "Le contenu performe mieux quand le CTA est aligné avec les priorités commerciales.",
      expected_impact: "Meilleure conversion des interactions en demandes entrantes.",
      owner: "client",
      status: "recommended",
      priority: "medium",
      due_date: dueDate(10),
      sort_order: 2,
      updated_at: now.toISOString(),
    },
    {
      tenant_id: tenantId,
      title: "Produire un batch de 6 formats éducatifs courts",
      rationale: "Ce format est le plus robuste sur Instagram et LinkedIn dans la démo.",
      expected_impact: "Cadence stabilisée et hausse de la visibilité récurrente.",
      owner: "shared",
      status: "in_progress",
      priority: "high",
      due_date: dueDate(14),
      sort_order: 3,
      updated_at: now.toISOString(),
    },
    {
      tenant_id: tenantId,
      title: "Documenter les apprentissages du mois dans le brief client",
      rationale: "Les décisions restent plus claires quand les insights sont reliés à des actions.",
      expected_impact: "Reporting plus utile pour le client et meilleure continuité stratégique.",
      owner: "jumpstart",
      status: "done",
      priority: "low",
      due_date: dueDate(3),
      sort_order: 4,
      updated_at: now.toISOString(),
    },
  ];
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
    demographics: buildDemoDemographicsRows(tenantId, accounts, now),
    strategyProfile: buildDemoStrategyProfile(tenantId, now),
    monthlyStrategyBrief: buildDemoMonthlyStrategyBrief(tenantId, now),
    strategyActionItems: buildDemoStrategyActionItems(tenantId, now),
  };
}
