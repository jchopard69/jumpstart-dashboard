import { consolidatedChange, monthlyReading } from "./monthly-reading";
import { buildContentObservatory } from "./content-observatory";
import { buildStrategicReading } from "./strategic-reading";
import { normalizeReviewPost } from "./monthly-review";
import { analyzeAccountBestTimes } from "./best-time";
import { countCalendarDays } from "./date";
import { computeJumpStartScore, type ScoreInput } from "./scoring";
import { buildPdfPostSummaries } from "./pdf-posts";
import { computeDashboardDataQuality } from "./dashboard-data-quality";
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

  const hasCurrentMetrics = data.metrics.length > 0;
  const qualityFor = (previous = false) => computeDashboardDataQuality({range:previous?data.prevRange:data.range,accounts:accounts.filter(account => data.perPlatform.some(p=>p.platform===account.platform) && (!accountId || accountId==='all' || account.id===accountId)),metrics:previous?(data.prevMetrics ?? []):data.metrics,perPlatform:data.perPlatform,lastSync:data.lastSync});
  const currentQuality=qualityFor(), previousQuality=qualityFor(true);
  const channels=data.perPlatform.map(channel=>({...channel,hasCurrent:data.metrics.some(r=>r.platform===channel.platform),hasPrevious:(data.prevMetrics ?? []).some(r=>r.platform===channel.platform),coverage:currentQuality.platformQuality.find(p=>p.platform===channel.platform)?.coverage??0,previousCoverage:previousQuality.platformQuality.find(p=>p.platform===channel.platform)?.coverage??0}));
  const kpis = (['views','engagements','followers','posts_count'] as const).map(key=>{const result=consolidatedChange(channels,key);return {label:{views:'Vues',engagements:'Interactions',followers:'Abonnés',posts_count:'Publications'}[key],value:result.current,delta:result.percent};});

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

  const pdfSummary = monthlyReading(channels).join(' ');
  const dataQuality = computeDashboardDataQuality({
    range: data.range,
    accounts: accounts.filter(account => data.perPlatform.some(item => item.platform === account.platform) &&
      (!accountId || accountId === "all" || account.id === accountId)),
    metrics: data.metrics,
    perPlatform: data.perPlatform,
    lastSync: data.lastSync,
  });
  const displayTopPosts = (await Promise.all(data.perPlatform.map(platform =>
    buildPdfPostSummaries(data.posts.filter(post => post.platform === platform.platform), data.posts.length)
  ))).flat();

  const documentProps: PdfDocumentProps = {
    tenantName,
    contentObservatory: buildContentObservatory(data.posts.map(normalizeReviewPost)),
    strategicSignals: buildStrategicReading(data.posts.map(normalizeReviewPost)),
    bestTimes: analyzeAccountBestTimes(data.posts,accounts.filter(a=>!accountId||accountId==='all'||a.id===accountId)),
    rangeLabel: `${data.range.start.toLocaleDateString("fr-FR")} - ${data.range.end.toLocaleDateString("fr-FR")}`,
    prevRangeLabel: `${data.prevRange.start.toLocaleDateString("fr-FR")} - ${data.prevRange.end.toLocaleDateString("fr-FR")}`,
    generatedAt: new Date().toLocaleString("fr-FR"),
    kpis,
    platforms: data.perPlatform.map((item) => ({
      platform: item.platform,
      measured: item.measured,
      previousMeasured: item.previousMeasured,
      hasPreviousMetrics: (data.prevMetrics ?? []).some(metric => metric.platform === item.platform),
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
  };

  return documentProps;
}
