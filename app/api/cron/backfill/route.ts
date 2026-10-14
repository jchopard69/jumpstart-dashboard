import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/crypto";
import { collectInstagramDays, instagramDates } from "@/lib/social-platforms/meta/account-insights";
import { getValidAccessToken } from "@/lib/social-platforms/core/token-manager";
import { fetchLinkedInDailyStats, fetchLinkedInPostsBackfill } from "@/lib/social-platforms/linkedin/backfill";
import { normalizeLinkedInFollowerSeries } from "@/lib/social-platforms/linkedin/community";
import { apiRequest, buildUrl } from "@/lib/social-platforms/core/api-client";
import { META_CONFIG } from "@/lib/social-platforms/meta/config";
import { isDemoTenant, logDemoAccess } from "@/lib/demo";
import { coerceMetric } from "@/lib/metrics";

function validateAuth(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron] CRON_SECRET not configured");
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const [scheme, token] = authHeader.split(" ");
    if (scheme?.toLowerCase() === "bearer" && token === cronSecret) {
      return true;
    }
  }

  return false;
}

export async function POST(request: Request) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId");
  const socialAccountId = searchParams.get("socialAccountId");
  const lookbackDays = Number(searchParams.get("days") ?? 365);
  const sinceDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const supabase = createSupabaseServiceClient();
  const { data: accounts, error } = await supabase
    .from("social_accounts")
    .select("id,tenant_id,platform,external_account_id,token_encrypted")
    .eq("auth_status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const filtered = (accounts ?? []).filter((account) => {
    if (socialAccountId && account.id !== socialAccountId) return false;
    if (tenantId && account.tenant_id !== tenantId) return false;
    return true;
  });

  const tenantDemoCache = new Map<string, boolean>();

  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    console.error("[backfill] ENCRYPTION_SECRET not configured");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const results: Array<{ id: string; platform: string; status: string; message?: string }> = [];

  for (const account of filtered) {
    let tenantIsDemo = tenantDemoCache.get(account.tenant_id);
    if (tenantIsDemo === undefined) {
      tenantIsDemo = await isDemoTenant(account.tenant_id, supabase);
      tenantDemoCache.set(account.tenant_id, tenantIsDemo);
    }
    if (tenantIsDemo) {
      logDemoAccess("backfill_skipped", { tenantId: account.tenant_id, socialAccountId: account.id });
      results.push({ id: account.id, platform: account.platform, status: "skipped", message: "demo_tenant" });
      continue;
    }

    if (account.platform !== "instagram" && account.platform !== "linkedin") {
      results.push({ id: account.id, platform: account.platform, status: "skipped" });
      continue;
    }

    try {
      const accessToken = account.token_encrypted ? decryptToken(account.token_encrypted, secret) : "";
      if (!accessToken) {
        throw new Error("Access token missing");
      }

      if (account.platform === "linkedin") {
        const [dailyMetrics, posts] = await Promise.all([
          fetchLinkedInDailyStats({
            externalAccountId: account.external_account_id,
            accessToken,
            since: sinceDate,
            until: new Date()
          }),
          fetchLinkedInPostsBackfill({
            externalAccountId: account.external_account_id,
            accessToken,
            since: sinceDate
          })
        ]);

        if (dailyMetrics.length) {
          const sorted = [...dailyMetrics].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
          const earliest = sorted[0]?.date;
          let baseline = 0;
          if (earliest) {
            const { data: baselineRow } = await supabase
              .from("social_daily_metrics")
              .select("followers,date")
              .eq("tenant_id", account.tenant_id)
              .eq("platform", account.platform)
              .eq("social_account_id", account.id)
              .lt("date", earliest)
              .order("date", { ascending: false })
              .limit(1)
              .maybeSingle();
            baseline = baselineRow?.followers ?? 0;
          }
          const normalized = normalizeLinkedInFollowerSeries(sorted, baseline);
          dailyMetrics.splice(0, dailyMetrics.length, ...normalized);
        }

        if (posts.length) {
          const externalPostIds = Array.from(
            new Set(
              posts
                .map((post) => String(post.external_post_id || ""))
                .filter((id) => id.length > 0)
            )
          );
          const existingMetricsByExternalId = new Map<string, Record<string, unknown>>();
          if (externalPostIds.length) {
            const { data: existingPosts, error: existingPostsError } = await supabase
              .from("social_posts")
              .select("external_post_id,metrics")
              .eq("tenant_id", account.tenant_id)
              .eq("platform", account.platform)
              .eq("social_account_id", account.id)
              .in("external_post_id", externalPostIds);

            if (existingPostsError) {
              console.warn(`[backfill] Failed to load existing LinkedIn post metrics: ${existingPostsError.message}`);
            } else {
              for (const existingPost of existingPosts ?? []) {
                existingMetricsByExternalId.set(
                  String(existingPost.external_post_id ?? ""),
                  (existingPost.metrics as Record<string, unknown> | null) ?? {}
                );
              }
            }
          }

          await supabase.from("social_posts").upsert(
            posts.map((post) => {
              const externalPostId = String(post.external_post_id ?? "");
              const incomingMetrics = (post.metrics as Record<string, unknown> | null) ?? {};
              const existingMetrics = existingMetricsByExternalId.get(externalPostId) ?? {};
              const incomingHasAnyMetric = Object.values(incomingMetrics).some(
                (value) => coerceMetric(value) > 0
              );
              const readMetric = (key: string) => {
                if (Object.prototype.hasOwnProperty.call(incomingMetrics, key)) {
                  const incoming = coerceMetric(incomingMetrics[key]);
                  if (incoming === 0 && !incomingHasAnyMetric) {
                    const existing = coerceMetric(existingMetrics[key]);
                    if (existing > 0) return existing;
                  }
                  return incoming;
                }
                return coerceMetric(existingMetrics[key]);
              };

              return {
                tenant_id: account.tenant_id,
                platform: account.platform,
                social_account_id: account.id,
                external_post_id: post.external_post_id,
                posted_at: post.posted_at,
                url: post.url,
                caption: post.caption,
                media_type: post.media_type,
                thumbnail_url: post.thumbnail_url,
                media_url: post.media_url,
                metrics: {
                  likes: readMetric("likes"),
                  comments: readMetric("comments"),
                  shares: readMetric("shares"),
                  saves: readMetric("saves"),
                  views: readMetric("views"),
                  plays: readMetric("plays"),
                  video_views: readMetric("video_views"),
                  media_views: readMetric("media_views"),
                  engagements: readMetric("engagements"),
                  impressions: readMetric("impressions"),
                  reach: readMetric("reach"),
                },
                raw_json: post.raw_json ?? null,
              };
            }),
            { onConflict: "tenant_id,platform,social_account_id,external_post_id" }
          );
        }

        if (dailyMetrics.length) {
          await supabase.from("social_daily_metrics").upsert(
            dailyMetrics.map((metric) => ({
              tenant_id: account.tenant_id,
              platform: account.platform,
              social_account_id: account.id,
              date: metric.date,
              followers: metric.followers ?? 0,
              impressions: metric.impressions ?? 0,
              reach: metric.reach ?? 0,
              engagements: metric.engagements ?? 0,
              likes: metric.likes ?? 0,
              comments: metric.comments ?? 0,
              shares: metric.shares ?? 0,
              saves: metric.saves ?? 0,
              views: metric.views ?? 0,
              watch_time: metric.watch_time ?? 0,
              posts_count: metric.posts_count ?? 0,
              raw_json: metric.raw_json ?? null
            })),
            { onConflict: "tenant_id,platform,social_account_id,date" }
          );
        }

        results.push({
          id: account.id,
          platform: account.platform,
          status: "ok",
          message: `posts:${posts.length}, days:${dailyMetrics.length}`
        });
        continue;
      }

      // Account-period views must come from account insights, never lifetime post totals.
      const token = await getValidAccessToken(account.id);
      if (!token) throw new Error("Compte Instagram à reconnecter");
      const dates = instagramDates().filter(day => new Date(day + "T00:00:00Z") >= sinceDate);
      const collected = await collectInstagramDays(dates, async (day, metrics) => {
        const dayStart = Math.floor(new Date(day + "T00:00:00Z").getTime() / 1000);
        return apiRequest("instagram", buildUrl(`${META_CONFIG.graphUrl}/${account.external_account_id}/insights`, {
          metric: metrics.join(","), period: "day", metric_type: "total_value",
          since: dayStart, until: dayStart + 86400, access_token: token
        }), { timeout: 10000 }, `instagram_backfill_${account.id}`, true);
      });
      for (const row of collected.rows) {
        const { error: writeError } = await supabase.from("social_daily_metrics").upsert([{
          tenant_id: account.tenant_id, social_account_id: account.id, platform: "instagram",
          date: row.date, views: row.views, raw_json: row.raw_json,
          ...(row.reach != null ? { reach: row.reach } : {}),
          ...(row.engagements != null ? { engagements: row.engagements } : {})
        }], { onConflict: "tenant_id,platform,social_account_id,date", defaultToNull: false });
        if (writeError) throw new Error("Enregistrement des statistiques Instagram impossible");
      }
      results.push({ id: account.id, platform: account.platform,
        status: collected.failed.length ? "partial" : "ok",
        message: `days:${collected.rows.length}, unavailable:${collected.failed.length}; account insights only (89-day maximum)` });
    } catch (backfillError: any) {
      results.push({ id: account.id, platform: account.platform, status: "failed", message: backfillError?.message ?? "Unknown error" });
    }
  }

  return NextResponse.json({ ok: true, results });
}

export async function GET(request: Request) {
  return POST(request);
}

export const dynamic = "force-dynamic";
