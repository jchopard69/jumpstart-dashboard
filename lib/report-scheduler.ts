import { renderToBuffer } from "@react-pdf/renderer";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { PdfDocument, type PdfDocumentProps } from "@/lib/pdf-document";
import { getPostEngagements, getPostVisibility, coerceMetric } from "@/lib/metrics";
import { computeJumpStartScore, type ScoreInput } from "@/lib/scoring";
import {
  generateStrategicInsights,
  generateKeyTakeaways,
  generateExecutiveSummary,
  type InsightsInput,
} from "@/lib/insights";
import { analyzeContentDna } from "@/lib/content-dna";
import { selectDisplayTopPosts } from "@/lib/top-posts";
import { sendReportEmail } from "@/lib/email";
import { createTenantNotification } from "@/lib/notifications";
import type { Platform } from "@/lib/types";

const REPORT_SCHEDULE_LOCK_TIMEOUT_MS = 30 * 60 * 1000;

// ---------------------------------------------------------------------------
// computeNextSendAt
// ---------------------------------------------------------------------------

/**
 * Compute the next send date for a report schedule.
 * Weekly: next Monday at 08:00 UTC
 * Monthly: 1st of next month at 08:00 UTC
 */
export function computeNextSendAt(
  frequency: "weekly" | "monthly",
  from?: Date
): string {
  const base = from ?? new Date();

  if (frequency === "weekly") {
    // Find next Monday
    const d = new Date(base);
    const dayOfWeek = d.getUTCDay(); // 0=Sunday, 1=Monday ...
    const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 7 : 8 - dayOfWeek;
    d.setUTCDate(d.getUTCDate() + daysUntilMonday);
    d.setUTCHours(8, 0, 0, 0);
    return d.toISOString();
  }

  // Monthly: 1st of next month at 08:00 UTC
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1, 8, 0, 0, 0));
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// PDF generation for a tenant (service-level, no user session)
// ---------------------------------------------------------------------------

async function generateTenantPdfBuffer(tenantId: string): Promise<Buffer> {
  const supabase = createSupabaseServiceClient();

  // Determine date ranges: last 30 days
  const now = new Date();
  const rangeEnd = new Date(now);
  const rangeStart = new Date(now);
  rangeStart.setDate(rangeStart.getDate() - 30);

  const prevEnd = new Date(rangeStart);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - 30);

  // Fetch tenant info
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name,is_demo")
    .eq("id", tenantId)
    .single();

  const tenantName = tenant?.name ?? "Client";

  // Fetch social accounts
  const { data: accounts } = await supabase
    .from("social_accounts")
    .select("id,platform,account_name")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  const platformList = Array.from(
    new Set((accounts ?? []).map((a) => a.platform as Platform))
  );

  // Fetch metrics for current period
  const { data: rawMetrics } = await supabase
    .from("social_daily_metrics")
    .select(
      "date,followers,impressions,reach,engagements,views,watch_time,posts_count,social_account_id,platform"
    )
    .eq("tenant_id", tenantId)
    .gte("date", rangeStart.toISOString().slice(0, 10))
    .lte("date", rangeEnd.toISOString().slice(0, 10))
    .order("date", { ascending: true });

  // Fetch metrics for previous period
  const { data: rawPrevMetrics } = await supabase
    .from("social_daily_metrics")
    .select(
      "date,followers,impressions,reach,engagements,views,watch_time,posts_count,social_account_id,platform"
    )
    .eq("tenant_id", tenantId)
    .gte("date", prevStart.toISOString().slice(0, 10))
    .lte("date", prevEnd.toISOString().slice(0, 10))
    .order("date", { ascending: true });

  const normalise = (rows: typeof rawMetrics) =>
    (rows ?? []).map((r) => ({
      ...r,
      followers: coerceMetric(r.followers),
      impressions: coerceMetric(r.impressions),
      reach: coerceMetric(r.reach),
      engagements: coerceMetric(r.engagements),
      views: coerceMetric(r.views),
      watch_time: coerceMetric(r.watch_time),
      posts_count: coerceMetric(r.posts_count),
    }));

  const metrics = normalise(rawMetrics);
  const prevMetrics = normalise(rawPrevMetrics);

  // Sum latest followers per account
  const sumLatestFollowers = (
    rows: Array<{
      social_account_id?: string | null;
      date?: string | null;
      followers?: number | null;
    }>
  ) => {
    const latestByAccount = new Map<string, { date: string; followers: number }>();
    for (const row of rows) {
      if (!row.social_account_id || row.followers == null || !row.date) continue;
      const existing = latestByAccount.get(row.social_account_id);
      if (!existing || row.date > existing.date) {
        latestByAccount.set(row.social_account_id, {
          date: row.date,
          followers: row.followers,
        });
      }
    }
    let sum = 0;
    for (const entry of latestByAccount.values()) sum += entry.followers;
    return sum;
  };

  const followers = sumLatestFollowers(metrics);
  const prevFollowers = sumLatestFollowers(prevMetrics) || followers;

  const sumField = (rows: typeof metrics, field: "views" | "reach" | "engagements" | "posts_count") =>
    rows.reduce((acc, r) => acc + (r[field] ?? 0), 0);

  const totals = {
    followers,
    views: sumField(metrics, "views"),
    reach: sumField(metrics, "reach"),
    engagements: sumField(metrics, "engagements"),
    posts_count: sumField(metrics, "posts_count"),
  };

  const prevTotals = {
    followers: prevFollowers,
    views: sumField(prevMetrics, "views"),
    reach: sumField(prevMetrics, "reach"),
    engagements: sumField(prevMetrics, "engagements"),
    postsCount: sumField(prevMetrics, "posts_count"),
  };

  const calcDelta = (current: number, previous: number) =>
    previous ? ((current - previous) / previous) * 100 : 0;

  const delta = {
    followers: calcDelta(totals.followers, prevTotals.followers),
    views: calcDelta(totals.views, prevTotals.views),
    reach: calcDelta(totals.reach, prevTotals.reach),
    engagements: calcDelta(totals.engagements, prevTotals.engagements),
    posts_count: calcDelta(totals.posts_count, prevTotals.postsCount),
  };

  const engagementRate = totals.views
    ? (totals.engagements / totals.views) * 100
    : 0;
  const prevEngagementRate = prevTotals.views
    ? (prevTotals.engagements / prevTotals.views) * 100
    : 0;
  const engagementDelta = calcDelta(engagementRate, prevEngagementRate);

  const kpis = [
    { label: "Abonnes", value: totals.followers, delta: delta.followers },
    { label: "Vues", value: totals.views, delta: delta.views },
    { label: "Portee", value: totals.reach, delta: delta.reach },
    { label: "Engagements", value: totals.engagements, delta: delta.engagements },
    { label: "Publications", value: totals.posts_count, delta: delta.posts_count },
    {
      label: "Taux d'engagement",
      value: Math.round(engagementRate * 10) / 10,
      delta: engagementDelta,
      suffix: "%",
    },
  ];

  const periodDays = 30;

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

  // Per-platform breakdown
  const perPlatform = platformList.map((platform) => {
    const pMetrics = metrics.filter((m) => m.platform === platform);
    const pPrev = prevMetrics.filter((m) => m.platform === platform);
    const pFollowers = sumLatestFollowers(pMetrics);
    const pPrevFollowers = sumLatestFollowers(pPrev) || pFollowers;
    const pTotals = {
      followers: pFollowers,
      views: sumField(pMetrics, "views"),
      reach: sumField(pMetrics, "reach"),
      engagements: sumField(pMetrics, "engagements"),
      posts_count: sumField(pMetrics, "posts_count"),
    };
    return {
      platform,
      totals: pTotals,
      delta: {
        followers: calcDelta(pFollowers, pPrevFollowers),
        views: calcDelta(pTotals.views, sumField(pPrev, "views")),
        reach: calcDelta(pTotals.reach, sumField(pPrev, "reach")),
        engagements: calcDelta(pTotals.engagements, sumField(pPrev, "engagements")),
        posts_count: calcDelta(pTotals.posts_count, sumField(pPrev, "posts_count")),
      },
    };
  });

  // Fetch posts
  const { data: posts } = await supabase
    .from("social_posts")
    .select("id,platform,media_type,posted_at,caption,metrics")
    .eq("tenant_id", tenantId)
    .gte("posted_at", rangeStart.toISOString())
    .lte("posted_at", rangeEnd.toISOString())
    .order("posted_at", { ascending: false })
    .limit(50);

  const postsList = posts ?? [];

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
    platforms: perPlatform.map((p) => ({
      platform: p.platform,
      totals: p.totals,
      delta: p.delta,
    })),
    posts: postsList.map((post) => ({
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
    posts: postsList.map((post) => ({
      platform: post.platform as Platform,
      media_type: post.media_type,
      posted_at: post.posted_at,
      caption: post.caption,
      metrics: post.metrics as any,
    })),
  });

  const displayTopPosts = selectDisplayTopPosts(postsList.slice(0, 10), 10)
    .slice(0, 8)
    .map((post) => ({
      caption: post.caption ?? "Sans titre",
      date: post.posted_at
        ? new Date(post.posted_at).toLocaleDateString("fr-FR")
        : "-",
      visibility: getPostVisibility(post.metrics, post.media_type),
      engagements: getPostEngagements(post.metrics),
    }));

  // Fetch collaboration data
  const { data: collaboration } = await supabase
    .from("collaboration")
    .select("shoot_days_remaining")
    .eq("tenant_id", tenantId)
    .single();

  const { data: shoots } = await supabase
    .from("upcoming_shoots")
    .select("shoot_date,location")
    .eq("tenant_id", tenantId)
    .order("shoot_date", { ascending: true })
    .limit(5);

  const { data: documents } = await supabase
    .from("documents")
    .select("file_name,tag")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(6);

  const documentProps: PdfDocumentProps = {
    tenantName,
    rangeLabel: `${rangeStart.toLocaleDateString("fr-FR")} - ${rangeEnd.toLocaleDateString("fr-FR")}`,
    prevRangeLabel: `${prevStart.toLocaleDateString("fr-FR")} - ${prevEnd.toLocaleDateString("fr-FR")}`,
    generatedAt: new Date().toLocaleString("fr-FR"),
    kpis,
    platforms: perPlatform.map((item) => ({
      platform: item.platform,
      totals: item.totals,
      delta: item.delta,
    })),
    posts: displayTopPosts,
    shootDays: collaboration?.shoot_days_remaining ?? 0,
    shoots: (shoots ?? []).map((s) => ({
      date: new Date(s.shoot_date).toLocaleDateString("fr-FR"),
      location: s.location ?? "",
    })),
    documents: (documents ?? []).map((doc) => ({
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
  };

  const pdfBuffer = await renderToBuffer(PdfDocument(documentProps));
  return Buffer.from(pdfBuffer);
}

// ---------------------------------------------------------------------------
// processScheduledReports
// ---------------------------------------------------------------------------

export async function processScheduledReports(): Promise<{
  sent: number;
  errors: number;
}> {
  const supabase = createSupabaseServiceClient();

  const { data: schedules, error } = await supabase
    .from("report_schedules")
    .select("id,tenant_id,frequency,recipients,is_active,last_sent_at,next_send_at,processing_started_at")
    .eq("is_active", true)
    .lte("next_send_at", new Date().toISOString());

  if (error) {
    console.error("[report-scheduler] Failed to query schedules:", error.message);
    return { sent: 0, errors: 0 };
  }

  if (!schedules?.length) {
    console.log("[report-scheduler] No reports due");
    return { sent: 0, errors: 0 };
  }

  let sent = 0;
  let errors = 0;

  for (const schedule of schedules) {
    let emailSent = false;
    const lockStartedAt = new Date().toISOString();
    const staleLockBefore = new Date(
      Date.now() - REPORT_SCHEDULE_LOCK_TIMEOUT_MS
    ).toISOString();
    let sentAtIso: string | null = null;
    let nextSendAtIso: string | null = null;

    try {
      const { data: claimedRows, error: claimError } = await supabase
        .from("report_schedules")
        .update({
          processing_started_at: lockStartedAt,
          updated_at: lockStartedAt,
        })
        .eq("id", schedule.id)
        .eq("is_active", true)
        .eq("next_send_at", schedule.next_send_at)
        .or(
          `processing_started_at.is.null,processing_started_at.lt.${staleLockBefore}`
        )
        .select("id")
        .limit(1);

      if (claimError) {
        console.error(
          `[report-scheduler] Failed to claim schedule ${schedule.id}:`,
          claimError.message
        );
        errors++;
        continue;
      }

      if (!claimedRows?.length) {
        console.log(
          `[report-scheduler] Schedule ${schedule.id} already claimed, skipping`
        );
        continue;
      }

      console.log(
        `[report-scheduler] Processing schedule ${schedule.id} for tenant ${schedule.tenant_id}`
      );

      // Get tenant name
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name")
        .eq("id", schedule.tenant_id)
        .single();

      const tenantName = tenant?.name ?? "Client";

      // Generate PDF
      const pdfBuffer = await generateTenantPdfBuffer(schedule.tenant_id);

      // Send email
      const result = await sendReportEmail({
        to: schedule.recipients,
        tenantName,
        frequency: schedule.frequency,
        pdfBuffer,
      });

      if (!result.success) {
        await supabase
          .from("report_schedules")
          .update({
            processing_started_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", schedule.id)
          .eq("processing_started_at", lockStartedAt);

        console.error(
          `[report-scheduler] Email failed for schedule ${schedule.id}:`,
          result.error
        );

        await createTenantNotification({
          tenantId: schedule.tenant_id,
          type: "info",
          title: "Echec d'envoi du rapport automatique",
          message: (result.error ?? "Erreur inconnue lors de l'envoi").slice(0, 400),
          metadata: {
            schedule_id: schedule.id,
            frequency: schedule.frequency,
            recipients: schedule.recipients,
          },
          dedupeWindowMinutes: 12 * 60,
        });
        errors++;
        continue;
      }

      emailSent = true;
      const now = new Date();
      const nextSend = computeNextSendAt(schedule.frequency, now);
      sentAtIso = now.toISOString();
      nextSendAtIso = nextSend;

      const { data: finalizedSchedule, error: finalizeError } = await supabase
        .from("report_schedules")
        .update({
          processing_started_at: null,
          last_sent_at: sentAtIso,
          next_send_at: nextSend,
          updated_at: sentAtIso,
        })
        .eq("id", schedule.id)
        .eq("processing_started_at", lockStartedAt)
        .select("id")
        .maybeSingle();

      if (finalizeError || !finalizedSchedule) {
        throw new Error(
          `Failed to finalize schedule ${schedule.id}: ${finalizeError?.message ?? "lock lost"}`
        );
      }

      console.log(
        `[report-scheduler] Sent report for schedule ${schedule.id}, next: ${nextSend}`
      );
      sent++;
    } catch (err) {
      if (emailSent && sentAtIso && nextSendAtIso) {
        const { error: rescueFinalizeError } = await supabase
          .from("report_schedules")
          .update({
            processing_started_at: null,
            last_sent_at: sentAtIso,
            next_send_at: nextSendAtIso,
            updated_at: new Date().toISOString(),
          })
          .eq("id", schedule.id);

        if (rescueFinalizeError) {
          console.error(
            `[report-scheduler] Failed to rescue-finalize schedule ${schedule.id}:`,
            rescueFinalizeError.message
          );
        }
      } else {
        await supabase
          .from("report_schedules")
          .update({
            processing_started_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", schedule.id)
          .eq("processing_started_at", lockStartedAt);

        await createTenantNotification({
          tenantId: schedule.tenant_id,
          type: "info",
          title: "Echec du rapport automatique",
          message: (err instanceof Error ? err.message : String(err)).slice(0, 400),
          metadata: {
            schedule_id: schedule.id,
            frequency: schedule.frequency,
            recipients: schedule.recipients,
          },
          dedupeWindowMinutes: 12 * 60,
        });
      }

      console.error(
        `[report-scheduler] Failed to process schedule ${schedule.id}:`,
        err instanceof Error ? err.message : err
      );
      errors++;
    }
  }

  console.log(`[report-scheduler] Done: ${sent} sent, ${errors} errors`);
  return { sent, errors };
}
