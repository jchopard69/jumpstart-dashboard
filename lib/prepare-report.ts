import { countCalendarDays } from "./date";
import { computeEngagementRate } from "./metrics";
import { computeJumpStartScore, type ScoreInput } from "./scoring";
import { generateExecutiveSummary, type InsightsInput } from "./insights";
import { buildPdfPostSummaries } from "./pdf-posts";
import { computeDashboardDataQuality } from "./dashboard-data-quality";
import { buildEditorialRoadmap } from "./editorial-roadmap";
import type { PdfDocumentProps } from "./pdf-document";
import type { Platform } from "./types";
import type { fetchDashboardData, fetchDashboardAccounts } from "./queries";

export async function prepareReport({ data, accounts, tenantName, watermark, accountId }: {
  data: Awaited<ReturnType<typeof fetchDashboardData>>;
  accounts: Awaited<ReturnType<typeof fetchDashboardAccounts>>;
  tenantName: string;
  watermark?: string;
  accountId?: string;
}): Promise<PdfDocumentProps> {
  const totals = {
    followers: data.totals?.followers ?? 0,
    views: data.totals?.views ?? 0,
    reach: data.totals?.reach ?? 0,
    engagements: data.totals?.engagements ?? 0,
    posts_count: data.totals?.posts_count ?? 0,
  };

  const prevTotals = {
    ...data.prevTotals,
    postsCount: data.prevTotals.posts_count,
  };

  const engagementRate = computeEngagementRate(totals.engagements, totals.views, totals.reach);
  const previousRate = computeEngagementRate(prevTotals.engagements, prevTotals.views, prevTotals.reach);
  const sameDenominator = (totals.views > 0) === (prevTotals.views > 0);
  const change = (value: number, previous: number) => previous > 0 ? (value - previous) / previous * 100 : null;
  const hasCurrentMetrics = data.metrics.length > 0;
  const hasMetric = (key: "views" | "reach" | "engagements") => hasCurrentMetrics && data.perPlatform.some(platform => platform.available[key]);
  const kpis = [
    { label: "Abonnés", value: hasCurrentMetrics ? totals.followers : null, delta: hasCurrentMetrics ? change(totals.followers, prevTotals.followers) : null },
    { label: "Vues", value: hasMetric("views") ? totals.views : null, delta: hasMetric("views") ? change(totals.views, prevTotals.views) : null },
    { label: "Portée cumulée", value: hasMetric("reach") ? totals.reach : null, delta: hasMetric("reach") ? change(totals.reach, prevTotals.reach) : null },
    { label: "Interactions", value: hasMetric("engagements") ? totals.engagements : null, delta: hasMetric("engagements") ? change(totals.engagements, prevTotals.engagements) : null },
    { label: "Publications", value: totals.posts_count, delta: change(totals.posts_count, prevTotals.postsCount) },
    { label: "Ratio d'interactions", value: engagementRate, delta: engagementRate != null && previousRate != null && sameDenominator ? change(engagementRate, previousRate) : null, suffix: "%" },
  ];

  const periodDays = data.range
    ? countCalendarDays(data.range)
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

  const pdfSummary = generateExecutiveSummary(insightsInput);
  const dataQuality = computeDashboardDataQuality({
    range: data.range,
    accounts: accounts.filter(account => data.perPlatform.some(item => item.platform === account.platform) &&
      (!accountId || accountId === "all" || account.id === accountId)),
    metrics: data.metrics,
    perPlatform: data.perPlatform,
    lastSync: data.lastSync,
  });
  const displayTopPosts = (await Promise.all(data.perPlatform.map(platform =>
    buildPdfPostSummaries(data.posts.filter(post => post.platform === platform.platform), 5)
  ))).flat();

  const documentProps: PdfDocumentProps = {
    tenantName,
    rangeLabel: `${data.range.start.toLocaleDateString("fr-FR")} - ${data.range.end.toLocaleDateString("fr-FR")}`,
    prevRangeLabel: `${data.prevRange.start.toLocaleDateString("fr-FR")} - ${data.prevRange.end.toLocaleDateString("fr-FR")}`,
    generatedAt: new Date().toLocaleString("fr-FR"),
    kpis,
    platforms: data.perPlatform.map((item) => ({
      platform: item.platform,
      hasCurrentMetrics: data.metrics.some(metric => metric.platform === item.platform),
      totals: item.totals,
      prevTotals: item.prevTotals,
      available: item.available,
      accountNames: accounts.filter(account => account.platform === item.platform && (!accountId || accountId === "all" || account.id === accountId)).map(account => account.account_name ?? item.platform),
      delta: item.delta,
    })),
    posts: displayTopPosts,
    shootDays: data.collaboration?.shoot_days_remaining ?? 0,
    shoots: (data.shoots ?? []).map((shoot) => ({
      date: new Date(shoot.shoot_date).toLocaleDateString("fr-FR"),
      location: shoot.location ?? "",
    })),
    documents: (data.documents ?? []).map((doc) => ({
      name: doc.file_name,
      tag: doc.tag,
    })),
    score: hasCurrentMetrics ? jumpStartScore : undefined,
    executiveSummary: pdfSummary,
    dataQuality,
    watermark,
    metrics: data.metrics,
    postsAnalyzed: data.posts.length,
    editorialRoadmap: buildEditorialRoadmap(data.posts, dataQuality.overallCoverage),
  };

  return documentProps;
}
