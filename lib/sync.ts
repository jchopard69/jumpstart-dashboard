import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/crypto";
import { getConnector } from "@/lib/connectors";
import { getValidAccessToken } from "@/lib/social-platforms/core/token-manager";
import type { Platform } from "@/lib/types";

const CONCURRENCY_LIMIT = 2;

// Safely convert raw API response to valid JSON
function safeJson(obj: unknown): Record<string, unknown> | null {
  if (!obj) return null;
  try {
    // Stringify and parse to remove any non-serializable values
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return null;
  }
}

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
          followers: Number(metric.followers) || 0,
          impressions: Number(metric.impressions) || 0,
          reach: Number(metric.reach) || 0,
          engagements: Number(metric.engagements) || 0,
          likes: Number(metric.likes) || 0,
          comments: Number(metric.comments) || 0,
          shares: Number(metric.shares) || 0,
          saves: Number(metric.saves) || 0,
          views: Number(metric.views) || 0,
          watch_time: Number(metric.watch_time) || 0,
          posts_count: Number(metric.posts_count) || 0,
          raw_json: null
        }));
        console.log(`[sync] Upserting ${metricsPayload.length} daily metrics for ${account.platform}`);
        const { error: metricsError } = await supabase.from("social_daily_metrics").upsert(metricsPayload, {
          onConflict: "tenant_id,platform,social_account_id,date"
        });
        if (metricsError) {
          console.error(`[sync] Metrics upsert error:`, metricsError);
          throw new Error(`Failed to upsert metrics: ${metricsError.message}`);
        }
        console.log(`[sync] Successfully upserted ${metricsPayload.length} daily metrics`);
      }

      if (result.posts.length) {
        console.log(`[sync] Processing ${result.posts.length} posts for ${account.platform}`);

        // Insert posts one by one to identify problematic ones
        let successCount = 0;
        let failedPosts: string[] = [];

        for (const post of result.posts) {
          try {
            const likes = Number(post.metrics?.likes) || 0;
            const comments = Number(post.metrics?.comments) || 0;
            const shares = Number(post.metrics?.shares) || 0;
            const views = Number(post.metrics?.views) || 0;
            const engagements = Number(post.metrics?.engagements) || 0;
            const impressions = Number(post.metrics?.impressions) || 0;

            const postPayload = {
              tenant_id: tenantId,
              platform: account.platform,
              social_account_id: account.id,
              external_post_id: String(post.external_post_id || `unknown_${Date.now()}`),
              posted_at: post.posted_at || new Date().toISOString(),
              url: post.url ? String(post.url).slice(0, 500) : null,
              caption: post.caption ? String(post.caption).replace(/\u0000/g, '').slice(0, 500) : null,
              media_type: post.media_type ? String(post.media_type).slice(0, 50) : null,
              thumbnail_url: post.thumbnail_url ? String(post.thumbnail_url).slice(0, 500) : null,
              media_url: post.media_url ? String(post.media_url).slice(0, 500) : null,
              metrics: { likes, comments, shares, views, engagements, impressions },
              raw_json: null
            };

            const { error } = await supabase.from("social_posts").upsert(postPayload, {
              onConflict: "tenant_id,platform,social_account_id,external_post_id"
            });

            if (error) {
              console.error(`[sync] Failed to insert post ${post.external_post_id}:`, error.message);
              failedPosts.push(String(post.external_post_id));
            } else {
              successCount++;
            }
          } catch (postError: any) {
            console.error(`[sync] Exception inserting post ${post.external_post_id}:`, postError.message);
            failedPosts.push(String(post.external_post_id));
          }
        }

        console.log(`[sync] Posts result: ${successCount} success, ${failedPosts.length} failed`);

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
