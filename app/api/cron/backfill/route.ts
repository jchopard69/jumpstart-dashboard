import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/crypto";
import { fetchInstagramMediaBackfill, fetchInstagramReachSeries, fetchInstagramTotalValueSnapshot, buildInstagramDailyMetrics } from "@/lib/social-platforms/meta/backfill";
import { fetchLinkedInDailyStats, fetchLinkedInPostsBackfill } from "@/lib/social-platforms/linkedin/backfill";
import { apiRequest, buildUrl } from "@/lib/social-platforms/core/api-client";
import { META_CONFIG } from "@/lib/social-platforms/meta/config";

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

  if (process.env.CRON_ALLOW_QUERY_SECRET === "true") {
    const { searchParams } = new URL(request.url);
    const secretParam = searchParams.get("secret");
    if (secretParam === cronSecret) {
      console.warn("[cron] Using query param auth is deprecated. Please use Authorization: Bearer header.");
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
  const includeViews = searchParams.get("includeViews") !== "false";
  const sinceDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const since = Math.floor(sinceDate.getTime() / 1000);
  const until = Math.floor(Date.now() / 1000);

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

  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    console.error("[backfill] ENCRYPTION_SECRET not configured");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const results: Array<{ id: string; platform: string; status: string; message?: string }> = [];

  for (const account of filtered) {
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

          let cumulative = baseline;
          for (const metric of sorted) {
            const delta = metric.followers ?? 0;
            cumulative += delta;
            metric.followers = cumulative;
          }
          dailyMetrics.splice(0, dailyMetrics.length, ...sorted);
        }

        if (posts.length) {
          await supabase.from("social_posts").upsert(
            posts.map((post) => ({
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
              metrics: post.metrics ?? {},
              raw_json: post.raw_json ?? null
            })),
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

      const [dailyReach, posts, totalValues] = await Promise.all([
        fetchInstagramReachSeries({
          externalAccountId: account.external_account_id,
          accessToken,
          since,
          until
        }),
        fetchInstagramMediaBackfill({
          externalAccountId: account.external_account_id,
          accessToken,
          sinceDate,
          includeViews
        }),
        fetchInstagramTotalValueSnapshot({
          externalAccountId: account.external_account_id,
          accessToken,
          since,
          until
        })
      ]);

      const accountInfoUrl = buildUrl(`${META_CONFIG.graphUrl}/${account.external_account_id}`, {
        fields: "followers_count",
        access_token: accessToken
      });
      const accountInfo: { followers_count?: number } = await apiRequest(
        "instagram",
        accountInfoUrl,
        {},
        "account_info_backfill"
      );
      const followers = Number(accountInfo.followers_count ?? 0);

      const dailyMetrics = buildInstagramDailyMetrics({
        posts,
        dailyReach,
        followers
      });

      const snapshotDate = new Date().toISOString().slice(0, 10);
      if (Object.keys(totalValues).length) {
        dailyMetrics.push({
          date: snapshotDate,
          followers,
          impressions: 0,
          reach: dailyReach.get(snapshotDate) ?? 0,
          engagements:
            totalValues.accounts_engaged ??
            totalValues.total_interactions ??
            0,
          likes: totalValues.likes ?? 0,
          comments: totalValues.comments ?? 0,
          shares: totalValues.shares ?? 0,
          saves: totalValues.saves ?? 0,
          views: totalValues.views ?? totalValues.content_views ?? 0,
          watch_time: 0,
          posts_count: 0,
          raw_json: totalValues
        });
      }

      if (posts.length) {
        await supabase.from("social_posts").upsert(
          posts.map((post) => ({
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
            metrics: post.metrics ?? {},
            raw_json: post.raw_json ?? null
          })),
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

      results.push({ id: account.id, platform: account.platform, status: "ok", message: `posts:${posts.length}, days:${dailyMetrics.length}` });
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
