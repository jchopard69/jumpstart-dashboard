import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { isDemoTenant } from "@/lib/demo";
import { analyzeContentDna, type ContentDnaInput } from "@/lib/content-dna";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/calendar/recommendations
 *
 * Generate AI-powered content recommendations using Claude.
 * Rate limited to 3 calls per tenant per hour.
 */
export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Non authentifie." }, { status: 401 });
    }

    const body = await request.json();
    const requestedTenantId = body.tenantId;

    // Resolve tenant access
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id,role")
      .eq("id", user.id)
      .single();

    let tenantId = profile?.tenant_id ?? null;
    if (requestedTenantId) {
      if (profile?.role === "agency_admin") {
        tenantId = requestedTenantId;
      } else {
        const { data: access } = await supabase
          .from("user_tenant_access")
          .select("tenant_id")
          .eq("user_id", user.id)
          .eq("tenant_id", requestedTenantId)
          .maybeSingle();
        if (access || profile?.tenant_id === requestedTenantId) {
          tenantId = requestedTenantId;
        }
      }
    }

    if (!tenantId) {
      return NextResponse.json({ message: "Acces tenant indisponible." }, { status: 403 });
    }

    // Check API key availability
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        {
          message: "La cle API Anthropic n'est pas configuree. Contactez votre administrateur.",
          code: "missing_api_key",
        },
        { status: 503 }
      );
    }

    // Rate limit: 3 calls per tenant per hour
    const rateLimitResult = checkRateLimit(`calendar_ai_${tenantId}`, {
      max: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
    });

    if (!rateLimitResult.allowed) {
      const retryMinutes = Math.ceil(rateLimitResult.retryAfterMs / 60000);
      return NextResponse.json(
        {
          message: `Limite atteinte. Reessayez dans ${retryMinutes} minute${retryMinutes > 1 ? "s" : ""}.`,
          code: "rate_limited",
        },
        { status: 429 }
      );
    }

    const serviceClient = createSupabaseServiceClient();
    const isDemo = await isDemoTenant(tenantId, supabase);

    // Gather context: last 50 posts with metrics
    const { data: posts } = await serviceClient
      .from("social_posts")
      .select(
        "id,platform,media_type,posted_at,caption,metrics"
      )
      .eq("tenant_id", tenantId)
      .order("posted_at", { ascending: false })
      .limit(50);

    // Run Content DNA analysis
    const dnaInput: ContentDnaInput = {
      posts: (posts ?? []).map((p) => ({
        platform: p.platform,
        media_type: p.media_type,
        posted_at: p.posted_at,
        caption: p.caption,
        metrics: p.metrics as ContentDnaInput["posts"][number]["metrics"],
      })),
    };
    const dnaResult = analyzeContentDna(dnaInput);

    // Get recent daily metrics for engagement trends
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: dailyMetrics } = await serviceClient
      .from("social_daily_metrics")
      .select("date,followers,impressions,engagements,platform")
      .eq("tenant_id", tenantId)
      .gte("date", thirtyDaysAgo.toISOString().split("T")[0])
      .order("date", { ascending: false })
      .limit(30);

    // Get current calendar entries for context
    const currentMonth = body.month || new Date().toISOString().slice(0, 7);
    const [year, mon] = currentMonth.split("-").map(Number);
    const startDate = `${year}-${String(mon).padStart(2, "0")}-01`;
    const endDate =
      mon === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(mon + 1).padStart(2, "0")}-01`;

    const { data: calendarEntries } = await serviceClient
      .from("content_calendar")
      .select("title,platform,planned_date,status")
      .eq("tenant_id", tenantId)
      .gte("planned_date", startDate)
      .lt("planned_date", endDate);

    // Build the prompt
    const prompt = buildPrompt({
      dnaResult,
      posts: posts ?? [],
      dailyMetrics: dailyMetrics ?? [],
      calendarEntries: calendarEntries ?? [],
      month: currentMonth,
      isDemo,
    });

    // Call Claude API
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropic = new Anthropic();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    // Parse response
    const textBlock = response.content.find((b) => b.type === "text");
    const rawText = textBlock?.type === "text" ? textBlock.text : "";

    const recommendations = parseRecommendations(rawText);

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("[calendar/recommendations] Error:", error);
    return NextResponse.json(
      { message: "Erreur lors de la generation des suggestions." },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------
type PromptContext = {
  dnaResult: ReturnType<typeof analyzeContentDna>;
  posts: Array<{ platform?: string; media_type?: string; caption?: string | null }>;
  dailyMetrics: Array<{ date?: string; impressions?: number; engagements?: number; platform?: string }>;
  calendarEntries: Array<{ title?: string; platform?: string; planned_date?: string; status?: string }>;
  month: string;
  isDemo: boolean;
};

function buildPrompt(ctx: PromptContext): string {
  const { dnaResult, posts, dailyMetrics, calendarEntries, month } = ctx;

  // Content DNA summary
  let dnaSummary = "Aucune donnee Content DNA disponible.";
  if (dnaResult.patterns.length > 0) {
    dnaSummary = dnaResult.patterns
      .map((p) => `- ${p.insight} (${p.detail})`)
      .join("\n");
    if (dnaResult.topFormat) dnaSummary += `\nFormat gagnant: ${dnaResult.topFormat}`;
    if (dnaResult.bestTimeWindow) dnaSummary += `\nMeilleur creneau: ${dnaResult.bestTimeWindow}`;
    if (dnaResult.optimalCaptionLength)
      dnaSummary += `\nLongueur de legende optimale: ${dnaResult.optimalCaptionLength}`;
  }

  // Platforms used
  const platforms = [...new Set(posts.map((p) => p.platform).filter(Boolean))];

  // Engagement trend
  let engagementTrend = "Pas de donnees recentes.";
  if (dailyMetrics.length > 0) {
    const totalEngagements = dailyMetrics.reduce((s, m) => s + (m.engagements ?? 0), 0);
    const totalImpressions = dailyMetrics.reduce((s, m) => s + (m.impressions ?? 0), 0);
    const avgEngRate =
      totalImpressions > 0
        ? ((totalEngagements / totalImpressions) * 100).toFixed(2)
        : "N/A";
    engagementTrend = `Sur les 30 derniers jours: ${totalEngagements} engagements, ${totalImpressions} impressions, taux moyen: ${avgEngRate}%`;
  }

  // Existing calendar entries for the month
  let calendarSummary = "Aucune entree dans le calendrier pour ce mois.";
  if (calendarEntries.length > 0) {
    calendarSummary = calendarEntries
      .map(
        (e) =>
          `- "${e.title}" (${e.platform || "toutes plateformes"}, ${e.planned_date || "pas de date"}, statut: ${e.status})`
      )
      .join("\n");
  }

  return `Tu es un expert en strategie de contenu pour les reseaux sociaux. Reponds UNIQUEMENT en francais.

Voici les donnees analytiques d'un client:

**Plateformes utilisees:** ${platforms.length > 0 ? platforms.join(", ") : "Non renseignees"}

**Analyse Content DNA (patterns identifies):**
${dnaSummary}

**Tendances d'engagement recentes:**
${engagementTrend}

**Entrees deja presentes dans le calendrier pour ${month}:**
${calendarSummary}

**Nombre de posts analyses:** ${dnaResult.postsAnalyzed}

---

Genere exactement 5 idees de contenu pour le mois de ${month}. Pour chaque idee, fournis les informations suivantes dans un format JSON strict.

Reponds UNIQUEMENT avec un tableau JSON (sans texte avant ni apres), au format suivant:
[
  {
    "title": "Titre court et accrocheur",
    "description": "Description detaillee en 2-3 phrases de l'idee de contenu, avec des conseils pratiques.",
    "platform": "instagram|facebook|linkedin|tiktok|youtube|twitter",
    "suggested_day": "YYYY-MM-DD",
    "suggested_time": "HH:MM",
    "tags": ["tag1", "tag2"]
  }
]

Regles:
- Adapte les suggestions aux patterns identifies dans le Content DNA
- Varie les plateformes en privilegiant celles deja utilisees par le client
- Evite de proposer des contenus similaires a ceux deja dans le calendrier
- Propose des dates et heures cohérentes avec le meilleur créneau identifie
- Les tags doivent etre pertinents et en francais
- Les dates doivent etre dans le mois de ${month}`;
}

// ---------------------------------------------------------------------------
// Parse AI response into structured recommendations
// ---------------------------------------------------------------------------
type Recommendation = {
  title: string;
  description: string;
  platform: string;
  suggested_day: string;
  suggested_time: string;
  tags: string[];
};

function parseRecommendations(text: string): Recommendation[] {
  try {
    // Try to extract JSON array from the response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item: Record<string, unknown>) =>
          typeof item.title === "string" && item.title.length > 0
      )
      .slice(0, 5)
      .map((item: Record<string, unknown>) => ({
        title: String(item.title),
        description: String(item.description || ""),
        platform: String(item.platform || ""),
        suggested_day: String(item.suggested_day || ""),
        suggested_time: String(item.suggested_time || ""),
        tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
      }));
  } catch {
    console.error("[calendar/recommendations] Failed to parse AI response");
    return [];
  }
}
