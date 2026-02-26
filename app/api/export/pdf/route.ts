import { renderToBuffer } from "@react-pdf/renderer";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { PdfDocument, type PdfDocumentProps } from "@/lib/pdf-document";
import { getPostEngagements, getPostVisibility } from "@/lib/metrics";
import { computeJumpStartScore, type ScoreInput } from "@/lib/scoring";
import {
  generateStrategicInsights,
  generateKeyTakeaways,
  generateExecutiveSummary,
  type InsightsInput,
} from "@/lib/insights";
import { analyzeContentDna } from "@/lib/content-dna";
import { fetchDashboardAccounts, fetchDashboardData } from "@/lib/queries";
import { selectDisplayTopPosts } from "@/lib/top-posts";
import {
  getDemoPdfWatermarkText,
  shouldUseDemoPdfWatermark,
  isDemoTenant,
} from "@/lib/demo";
import type { Platform } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const authClient = createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await authClient
    .from("profiles")
    .select("id,email,full_name,role,tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return Response.json({ error: "Profile missing" }, { status: 403 });
  }

  const requestedTenantId = searchParams.get("tenantId") ?? undefined;
  const isAdmin = profile.role === "agency_admin" && !!requestedTenantId;
  const tenantId = isAdmin ? requestedTenantId! : profile.tenant_id;

  if (!tenantId) {
    return Response.json({ error: "Tenant missing" }, { status: 403 });
  }

  const supabase = isAdmin ? createSupabaseServiceClient() : authClient;

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name,is_demo")
    .eq("id", tenantId)
    .single();

  const preset = (searchParams.get("preset") ?? "last_30_days") as any;
  const accountId = searchParams.get("accountId") ?? undefined;
  const platformParam = searchParams.get("platform") as Platform | "all" | null;

  const accounts = await fetchDashboardAccounts({
    profile,
    tenantId: requestedTenantId,
  });
  const platformList = Array.from(new Set(accounts.map((account) => account.platform)));

  const data = await fetchDashboardData({
    preset,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    platform: (platformParam as Platform | "all") ?? "all",
    socialAccountId: accountId,
    platforms: platformList,
    profile,
    tenantId: requestedTenantId,
  });

  const totals = {
    followers: data.totals?.followers ?? 0,
    views: data.totals?.views ?? 0,
    reach: data.totals?.reach ?? 0,
    engagements: data.totals?.engagements ?? 0,
    posts_count: data.totals?.posts_count ?? 0,
  };

  const prevTotals = (data.prevMetrics ?? []).reduce(
    (acc, row) => {
      acc.views += row.views ?? 0;
      acc.reach += row.reach ?? 0;
      acc.engagements += row.engagements ?? 0;
      return acc;
    },
    { followers: 0, views: 0, reach: 0, engagements: 0, postsCount: 0 }
  );
  const prevFollowers =
    data.delta.followers !== 0 && totals.followers
      ? Math.round(totals.followers / (1 + data.delta.followers / 100))
      : totals.followers;
  prevTotals.followers = prevFollowers;

  const calcDelta = (current: number, previous: number) =>
    previous ? ((current - previous) / previous) * 100 : 0;

  const engagementRate = totals.views ? (totals.engagements / totals.views) * 100 : 0;
  const prevEngagementRate = prevTotals.views
    ? (prevTotals.engagements / prevTotals.views) * 100
    : 0;
  const engagementDelta = calcDelta(engagementRate, prevEngagementRate);

  const kpis = [
    { label: "Abonnés", value: totals.followers, delta: data.delta.followers },
    { label: "Vues", value: totals.views, delta: data.delta.views },
    { label: "Portée", value: totals.reach, delta: data.delta.reach },
    { label: "Engagements", value: totals.engagements, delta: data.delta.engagements },
    { label: "Publications", value: totals.posts_count, delta: data.delta.posts_count },
    {
      label: "Taux d'engagement",
      value: Math.round(engagementRate * 10) / 10,
      delta: engagementDelta,
      suffix: "%",
    },
  ];

  const msDay = 24 * 60 * 60 * 1000;
  const periodDays = data.range
    ? Math.max(1, Math.round((data.range.end.getTime() - data.range.start.getTime()) / msDay))
    : 30;

  const scoreInput: ScoreInput = {
    followers: totals.followers,
    views: totals.views,
    reach: totals.reach,
    engagements: totals.engagements,
    postsCount: totals.posts_count,
    prevFollowers: prevTotals.followers,
    prevViews: prevTotals.views,
    prevReach: prevTotals.reach,
    prevEngagements: prevTotals.engagements,
    prevPostsCount: prevTotals.postsCount,
    periodDays,
  };
  const jumpStartScore = computeJumpStartScore(scoreInput);

  const insightsInput: InsightsInput = {
    totals: {
      followers: totals.followers,
      views: totals.views,
      reach: totals.reach,
      engagements: totals.engagements,
      postsCount: totals.posts_count,
    },
    prevTotals: {
      followers: prevTotals.followers,
      views: prevTotals.views,
      reach: prevTotals.reach,
      engagements: prevTotals.engagements,
      postsCount: prevTotals.postsCount,
    },
    platforms: data.perPlatform.map((platform) => ({
      platform: platform.platform,
      totals: platform.totals,
      delta:
        platform.delta ?? {
          followers: 0,
          views: 0,
          reach: 0,
          engagements: 0,
          posts_count: 0,
        },
    })),
    posts: data.posts.map((post) => ({
      platform: post.platform as Platform,
      media_type: post.media_type,
      posted_at: post.posted_at,
      metrics: post.metrics as any,
    })),
    score: jumpStartScore,
    periodDays,
  };

  const pdfInsights = generateStrategicInsights(insightsInput);
  const pdfTakeaways = generateKeyTakeaways(insightsInput);
  const pdfSummary = generateExecutiveSummary(insightsInput);

  const contentDna = analyzeContentDna({
    posts: data.posts.map((post) => ({
      platform: post.platform as Platform,
      media_type: post.media_type,
      posted_at: post.posted_at,
      caption: post.caption,
      metrics: post.metrics as any,
    })),
  });

  const displayTopPosts = selectDisplayTopPosts(data.posts.slice(0, 10), 10)
    .slice(0, 8)
    .map((post) => ({
      caption: post.caption ?? "Sans titre",
      date: post.posted_at ? new Date(post.posted_at).toLocaleDateString("fr-FR") : "-",
      visibility: getPostVisibility(post.metrics, post.media_type),
      engagements: getPostEngagements(post.metrics),
    }));

  const isDemo = Boolean(tenant?.is_demo) || (await isDemoTenant(tenantId));
  const watermark = isDemo && shouldUseDemoPdfWatermark() ? getDemoPdfWatermarkText() : undefined;

  const documentProps: PdfDocumentProps = {
    tenantName: tenant?.name ?? "Client",
    rangeLabel: `${data.range.start.toLocaleDateString("fr-FR")} - ${data.range.end.toLocaleDateString("fr-FR")}`,
    prevRangeLabel: `${data.prevRange.start.toLocaleDateString("fr-FR")} - ${data.prevRange.end.toLocaleDateString("fr-FR")}`,
    generatedAt: new Date().toLocaleString("fr-FR"),
    kpis,
    platforms: data.perPlatform.map((item) => ({
      platform: item.platform,
      totals: item.totals,
      delta: item.delta,
    })),
    posts: displayTopPosts,
    shootDays: data.collaboration?.shoot_days_remaining ?? 0,
    shoots: (data.shoots ?? []).slice(0, 5).map((shoot) => ({
      date: new Date(shoot.shoot_date).toLocaleDateString("fr-FR"),
      location: shoot.location ?? "",
    })),
    documents: (data.documents ?? []).slice(0, 6).map((doc) => ({
      name: doc.file_name,
      tag: doc.tag,
    })),
    score: jumpStartScore,
    keyTakeaways: pdfTakeaways,
    executiveSummary: pdfSummary,
    insights: pdfInsights.map((insight) => ({
      title: insight.title,
      description: insight.description,
    })),
    contentDna:
      contentDna.patterns.length > 0
        ? contentDna.patterns.map((pattern) => ({
            label: pattern.label,
            insight: pattern.insight,
            detail: pattern.detail,
            strength: pattern.strength,
          }))
        : undefined,
    watermark,
  };

  try {
    const pdfBuffer = await renderToBuffer(PdfDocument(documentProps));
    const safeName = (tenant?.name ?? "client")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+$/, "");
    const dateFrom = data.range.start.toISOString().slice(0, 10);
    const dateTo = data.range.end.toISOString().slice(0, 10);

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=rapport-${safeName}-${dateFrom}-${dateTo}.pdf`,
      },
    });
  } catch (error) {
    console.error("[pdf] generation failed", error);
    return Response.json(
      { error: "Une erreur est survenue lors de la génération du PDF." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
