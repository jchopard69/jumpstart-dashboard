import { buildDashboardOpportunities } from "./dashboard-opportunities";
import { analyzeContentDna } from "./content-dna";
import { buildPlatformMix } from "./platform-mix";
import { buildMomentHighlights } from "./moment-highlights";
import { getPostEngagements, getPostVisibility } from "./metrics";
import type { DashboardMetric, PlatformData, PostData } from "./types/dashboard";

export type ContentIdea = {
  title: string;
  platform: string;
  format: string;
  angle: string;
  hook: string;
  rationale: string;
  calendarHint: string;
};

export type ContentIdeasResult = {
  ideas: ContentIdea[];
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    model?: string;
  };
};

type GenerateContentIdeasInput = {
  data: {
    totals: {
      followers: number;
      views: number;
      reach: number;
      engagements: number;
      posts_count: number;
    } | null;
    metrics: DashboardMetric[];
    perPlatform: PlatformData[];
    posts: PostData[];
  };
  prompt?: string;
  count?: number;
};

type IdeasDashboardData = GenerateContentIdeasInput["data"];

type OpenAIUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
};

const DEFAULT_MODEL = "gpt-5-mini";

function formatPost(post: PostData) {
  const visibility = getPostVisibility(post.metrics, post.media_type);
  const engagements = getPostEngagements(post.metrics);
  return {
    platform: post.platform,
    format: post.media_type,
    caption: post.caption?.slice(0, 220) ?? "Sans caption",
    visibility: visibility.value,
    visibilityLabel: visibility.label,
    engagements,
    postedAt: post.posted_at,
  };
}

function buildIdeasContext(data: IdeasDashboardData) {
  const contentDna = analyzeContentDna({
    posts: data.posts.map((post) => ({
      platform: post.platform,
      media_type: post.media_type ?? undefined,
      posted_at: post.posted_at,
      caption: post.caption,
      metrics: post.metrics,
    })),
  });
  const opportunities = buildDashboardOpportunities(data.posts);
  const platformMix = buildPlatformMix(data.perPlatform);
  const momentHighlights = buildMomentHighlights({ metrics: data.metrics, posts: data.posts });
  const topPosts = [...data.posts]
    .map((post) => ({
      post,
      score: getPostVisibility(post.metrics, post.media_type).value + getPostEngagements(post.metrics) * 4,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ post }) => formatPost(post));

  return {
    totals: data.totals,
    platformMix: platformMix.items.slice(0, 5),
    contentDna: {
      postsAnalyzed: contentDna.postsAnalyzed,
      patterns: contentDna.patterns.map((pattern) => ({
        label: pattern.label,
        insight: pattern.insight,
        detail: pattern.detail,
        strength: pattern.strength,
      })),
    },
    opportunities: opportunities.map((opportunity) => ({
      title: opportunity.title,
      impact: opportunity.impact,
      evidence: opportunity.evidence,
    })),
    momentHighlights: momentHighlights.map((highlight) => ({
      date: highlight.date,
      metric: highlight.metric,
      lift: highlight.lift,
      summary: highlight.summary,
    })),
    topPosts,
  };
}

function extractResponseText(response: any): string {
  if (typeof response?.output_text === "string") return response.output_text;
  const chunks: string[] = [];
  for (const item of response?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

function parseIdeas(text: string): ContentIdea[] {
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  const candidate = jsonStart >= 0 && jsonEnd > jsonStart ? text.slice(jsonStart, jsonEnd + 1) : text;
  const parsed = JSON.parse(candidate);
  if (!Array.isArray(parsed.ideas)) return [];
  return parsed.ideas
    .map((idea: any) => ({
      title: String(idea.title ?? "").trim(),
      platform: String(idea.platform ?? "").trim(),
      format: String(idea.format ?? "").trim(),
      angle: String(idea.angle ?? "").trim(),
      hook: String(idea.hook ?? "").trim(),
      rationale: String(idea.rationale ?? "").trim(),
      calendarHint: String(idea.calendarHint ?? "").trim(),
    }))
    .filter((idea: ContentIdea) => idea.title && idea.platform && idea.format)
    .slice(0, 8);
}

export async function generateContentIdeas({
  data,
  prompt,
  count = 6,
}: GenerateContentIdeasInput): Promise<ContentIdeasResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const model = process.env.OPENAI_CONTENT_IDEAS_MODEL?.trim() || DEFAULT_MODEL;
  const context = buildIdeasContext(data);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions:
        "Tu es un stratège social media senior pour JumpStart Studio. Tu génères des idées de contenus concrètes, non génériques, strictement ancrées dans les statistiques fournies. Réponds uniquement en JSON valide.",
      input: JSON.stringify({
        request: prompt?.slice(0, 600) || "Propose des idées de contenus pour alimenter le calendrier éditorial.",
        expectedOutput:
          "Retourne { ideas: [{ title, platform, format, angle, hook, rationale, calendarHint }] } en français.",
        count,
        dashboardContext: context,
      }),
      max_output_tokens: 1200,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${message.slice(0, 240)}`);
  }

  const payload = await response.json();
  const ideas = parseIdeas(extractResponseText(payload));
  const usage = payload.usage as OpenAIUsage | undefined;

  return {
    ideas,
    usage: {
      inputTokens: usage?.input_tokens,
      outputTokens: usage?.output_tokens,
      totalTokens: usage?.total_tokens,
      model,
    },
  };
}
