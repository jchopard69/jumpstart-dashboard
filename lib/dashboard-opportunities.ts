import { getPostEngagements, getPostVisibility } from "./metrics";
import type { Platform } from "./types";

type PostInput = {
  platform?: Platform | string | null;
  media_type?: string | null;
  caption?: string | null;
  posted_at?: string | null;
  metrics?: unknown;
  url?: string | null;
};

export type DashboardOpportunity = {
  id: string;
  title: string;
  automation: string;
  impact: string;
  evidence: string;
  confidence: "Haute" | "Moyenne";
  href?: string | null;
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "X",
};

function platformLabel(platform?: string | null): string {
  return platform ? PLATFORM_LABELS[platform] ?? platform : "contenu";
}

function formatMetric(value: number): string {
  return new Intl.NumberFormat("fr-FR", { notation: value >= 10_000 ? "compact" : "standard" }).format(Math.round(value));
}

function formatRate(value: number): string {
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

export function buildDashboardOpportunities(posts: PostInput[]): DashboardOpportunity[] {
  const enriched = posts
    .map((post) => {
      const visibility = getPostVisibility(post.metrics as any, post.media_type).value;
      const engagements = getPostEngagements(post.metrics as any);
      const rate = visibility > 0 ? (engagements / visibility) * 100 : 0;
      return { post, visibility, engagements, rate };
    })
    .filter((item) => item.visibility > 0 || item.engagements > 0);

  if (!enriched.length) return [];

  const opportunities: DashboardOpportunity[] = [];
  const byVisibility = [...enriched].sort((a, b) => b.visibility - a.visibility)[0];
  const byEngagement = [...enriched].sort((a, b) => b.engagements - a.engagements)[0];
  const byRate = enriched
    .filter((item) => item.visibility >= 100 && item.engagements >= 10)
    .sort((a, b) => b.rate - a.rate)[0];

  if (byEngagement && byEngagement.engagements > 0) {
    opportunities.push({
      id: "replicate-engagement-winner",
      title: `Répliquer le format gagnant ${platformLabel(byEngagement.post.platform as string)}`,
      automation: "Prioriser ce format dans la prochaine production et tester une variation courte avec le même angle.",
      impact: "Accélérer la production des contenus qui génèrent déjà de l'interaction.",
      evidence: `${formatMetric(byEngagement.engagements)} engagements sur ${formatMetric(byEngagement.visibility)} vues/portée`,
      confidence: byEngagement.visibility > 0 ? "Haute" : "Moyenne",
      href: byEngagement.post.url,
    });
  }

  if (byVisibility && byVisibility.visibility > 0 && byVisibility.post !== byEngagement?.post) {
    opportunities.push({
      id: "amplify-visibility-winner",
      title: `Amplifier le contenu le plus visible`,
      automation: "Étudier un repost, une sponsorisation légère ou une déclinaison multi-plateforme du contenu.",
      impact: "Transformer un signal organique fort en campagne plus scalable.",
      evidence: `${formatMetric(byVisibility.visibility)} vues/portée détectées`,
      confidence: byVisibility.engagements > 0 ? "Haute" : "Moyenne",
      href: byVisibility.post.url,
    });
  }

  if (byRate && byRate.post !== byEngagement?.post && byRate.post !== byVisibility?.post) {
    opportunities.push({
      id: "boost-high-rate",
      title: "Exploiter un contenu à fort rendement",
      automation: "Conserver l'angle et le rythme du message, puis l'étendre sur un format plus visible.",
      impact: "Identifier les contenus moins visibles mais très efficaces auprès de l'audience.",
      evidence: `${formatRate(byRate.rate)} de taux d'engagement`,
      confidence: "Moyenne",
      href: byRate.post.url,
    });
  }

  if (!opportunities.length) {
    opportunities.push({
      id: "baseline-learning-loop",
      title: "Structurer la boucle d'apprentissage",
      automation: "Taguer automatiquement les prochains contenus par format, plateforme et intention.",
      impact: "Créer une base de décision fiable pour recommander les prochains angles créatifs.",
      evidence: `${posts.length} contenus disponibles`,
      confidence: "Moyenne",
    });
  }

  return opportunities.slice(0, 3);
}
