import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { coerceMetric } from "@/lib/metrics";
import { decryptToken } from "@/lib/crypto";
import { getConnector } from "@/lib/connectors";
import { getValidAccessToken } from "@/lib/social-platforms/core/token-manager";
import type { Platform } from "@/lib/types";

const CONCURRENCY_LIMIT = 2;

async function runWithLimit<T>(items: T[], handler: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = new Array(CONCURRENCY_LIMIT).fill(null).map(async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item) return;
      await handler(item);
    }
  });
  await Promise.all(workers);
}

export async function runTenantSync(tenantId: string, platform?: Platform) {
  const supabase = createSupabaseServiceClient();
  const { data: accounts, error } = await supabase
    .from("social_accounts")
    .select("id,tenant_id,platform,external_account_id,token_encrypted,refresh_token_encrypted")
    .eq("tenant_id", tenantId)
    .eq("auth_status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const filtered = platform ? accounts.filter((acc) => acc.platform === platform) : accounts;
  if (!filtered.length) {
    return;
  }

  await runWithLimit(filtered, async (account) => {
    const { data: log, error: logError } = await supabase
      .from("sync_logs")
      .insert({
        tenant_id: tenantId,
        platform: account.platform,
        social_account_id: account.id,
        status: "running",
        started_at: new Date().toISOString()
      })
      .select()
      .single();
    if (logError || !log?.id) {
      throw new Error(`Failed to create sync log: ${logError?.message ?? "missing log id"}`);
    }

    try {
      const connector = getConnector(account.platform);
      const secret = process.env.ENCRYPTION_SECRET ?? "";
      if ((account.token_encrypted || account.refresh_token_encrypted) && !secret) {
        throw new Error("ENCRYPTION_SECRET is missing");
      }
      const accessToken = account.token_encrypted
        ? await getValidAccessToken(account.id)
        : null;
      const refreshToken = account.refresh_token_encrypted
        ? decryptToken(account.refresh_token_encrypted, secret)
        : null;

      const result = await connector.sync({
        tenantId,
        socialAccountId: account.id,
        externalAccountId: account.external_account_id,
        accessToken,
        refreshToken
      });

      if (account.platform === "linkedin" && result.dailyMetrics.length) {
        const sorted = [...result.dailyMetrics].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
        const earliest = sorted[0]?.date;
        let baseline = 0;
        if (earliest) {
          const { data: baselineRow } = await supabase
            .from("social_daily_metrics")
            .select("followers,date")
            .eq("tenant_id", tenantId)
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
        result.dailyMetrics = sorted;
      }

      if (result.dailyMetrics.length) {
        const metricsPayload = result.dailyMetrics.map((metric) => ({
          tenant_id: tenantId,
          platform: account.platform,
          social_account_id: account.id,
          date: metric.date,
          followers: coerceMetric(metric.followers),
          impressions: coerceMetric(metric.impressions),
          reach: coerceMetric(metric.reach),
          engagements: coerceMetric(metric.engagements),
          likes: coerceMetric(metric.likes),
          comments: coerceMetric(metric.comments),
          shares: coerceMetric(metric.shares),
          saves: coerceMetric(metric.saves),
          views: coerceMetric(metric.views),
          watch_time: coerceMetric(metric.watch_time),
          posts_count: coerceMetric(metric.posts_count),
          raw_json: null
        }));
        const { error: metricsError } = await supabase.from("social_daily_metrics").upsert(metricsPayload, {
          onConflict: "tenant_id,platform,social_account_id,date"
        });
        if (metricsError) {
          throw new Error(`Failed to upsert metrics: ${metricsError.message}`);
        }
      }

      if (result.posts.length) {
        const externalPostIds = Array.from(
          new Set(
            result.posts
              .map((post) => String(post.external_post_id || ""))
              .filter((id) => id.length > 0)
          )
        );
        const existingMetricsByExternalId = new Map<string, Record<string, unknown>>();
        if (externalPostIds.length) {
          const { data: existingPosts, error: existingPostsError } = await supabase
            .from("social_posts")
            .select("external_post_id,metrics")
            .eq("tenant_id", tenantId)
            .eq("platform", account.platform)
            .eq("social_account_id", account.id)
            .in("external_post_id", externalPostIds);
          if (existingPostsError) {
            console.warn(`[sync] Failed to load existing post metrics for ${account.platform}: ${existingPostsError.message}`);
          } else {
            for (const existingPost of existingPosts ?? []) {
              existingMetricsByExternalId.set(
                String(existingPost.external_post_id ?? ""),
                (existingPost.metrics as Record<string, unknown> | null) ?? {}
              );
            }
          }
        }

        // Insert posts one by one to identify problematic ones
        let successCount = 0;
        let failedPosts: string[] = [];

        for (const post of result.posts) {
          try {
            const externalPostId = String(post.external_post_id || `unknown_${Date.now()}`);
            const incomingMetrics = (post.metrics as Record<string, unknown> | null) ?? {};
            const existingMetrics = existingMetricsByExternalId.get(externalPostId) ?? {};
            const readMetric = (key: string) => {
              if (Object.prototype.hasOwnProperty.call(incomingMetrics, key)) {
                return coerceMetric(incomingMetrics[key]);
              }
              return coerceMetric(existingMetrics[key]);
            };

            const likes = readMetric("likes");
            const comments = readMetric("comments");
            const shares = readMetric("shares");
            const saves = readMetric("saves");
            const views = readMetric("views");
            const plays = readMetric("plays");
            const videoViews = readMetric("video_views");
            const mediaViews = readMetric("media_views");
            const engagements = readMetric("engagements");
            const impressions = readMetric("impressions");
            const reach = readMetric("reach");

            const postPayload = {
              tenant_id: tenantId,
              platform: account.platform,
              social_account_id: account.id,
              external_post_id: externalPostId,
              posted_at: post.posted_at || new Date().toISOString(),
              url: post.url ? String(post.url).slice(0, 500) : null,
              caption: post.caption ? String(post.caption).replace(/\u0000/g, '').slice(0, 500) : null,
              media_type: post.media_type ? String(post.media_type).slice(0, 50) : null,
              thumbnail_url: post.thumbnail_url ? String(post.thumbnail_url).slice(0, 500) : null,
              media_url: post.media_url ? String(post.media_url).slice(0, 500) : null,
              metrics: {
                likes,
                comments,
                shares,
                saves,
                views,
                plays,
                video_views: videoViews,
                media_views: mediaViews,
                engagements,
                impressions,
                reach
              },
              raw_json: null
            };

            const { error } = await supabase.from("social_posts").upsert(postPayload, {
              onConflict: "tenant_id,platform,social_account_id,external_post_id"
            });

            if (error) {
              failedPosts.push(String(post.external_post_id));
            } else {
              successCount++;
            }
          } catch {
            failedPosts.push(String(post.external_post_id));
          }
        }

        if (failedPosts.length > 0) {
          console.warn(`[sync] ${account.platform}: ${successCount} posts OK, ${failedPosts.length} failed`);
        }

        if (failedPosts.length > 0 && successCount === 0) {
          throw new Error(`Failed to upsert posts: all ${failedPosts.length} posts failed`);
        }
      }

      const { error: accountUpdateError } = await supabase
        .from("social_accounts")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", account.id);
      if (accountUpdateError) {
        throw new Error(`Failed to update social account: ${accountUpdateError.message}`);
      }

      const { error: logUpdateError } = await supabase
        .from("sync_logs")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          rows_upserted: result.dailyMetrics.length + result.posts.length
        })
        .eq("id", log.id);
      if (logUpdateError) {
        throw new Error(`Failed to update sync log: ${logUpdateError.message}`);
      }
    } catch (syncError: any) {
      const { error: logFailError } = await supabase
        .from("sync_logs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error_message: syncError?.message ?? "Unknown error"
        })
        .eq("id", log.id);
      if (logFailError) {
        console.error("[sync] Failed to update sync log:", logFailError.message);
      }
    }
  });
}

export async function runGlobalSync() {
  const supabase = createSupabaseServiceClient();
  const { data: tenants, error } = await supabase.from("tenants").select("id").eq("is_active", true);
  if (error) {
    throw new Error(error.message);
  }

  for (const tenant of tenants) {
    await runTenantSync(tenant.id);
  }
}
