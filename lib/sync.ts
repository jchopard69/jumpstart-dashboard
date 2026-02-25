import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { coerceMetric } from "@/lib/metrics";
import { decryptToken } from "@/lib/crypto";
import { getConnector } from "@/lib/connectors";
import { getValidAccessToken } from "@/lib/social-platforms/core/token-manager";
import { computeJumpStartScore } from "@/lib/scoring";
import { saveScoreSnapshot } from "@/lib/score-history";
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

  let syncSucceeded = false;

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
      const secret = process.env.ENCRYPTION_SECRET;
      if ((account.token_encrypted || account.refresh_token_encrypted) && !secret) {
        throw new Error("ENCRYPTION_SECRET is not configured");
      }
      const accessToken = account.token_encrypted
        ? await getValidAccessToken(account.id)
        : null;
      const refreshToken = account.refresh_token_encrypted
        ? decryptToken(account.refresh_token_encrypted, secret!)
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

        // The connector puts an absolute total on the latest date (much larger
        // than daily gains on other dates).  Detect this: if the last entry's
        // followers value is significantly larger than the typical daily gain,
        // treat it as the absolute total rather than a delta.
        const lastEntry = sorted[sorted.length - 1];
        const lastValue = lastEntry?.followers ?? 0;
        const dailyGains = sorted.slice(0, -1);
        const maxDailyGain = dailyGains.reduce((max, m) => Math.max(max, m.followers ?? 0), 0);

        // Heuristic: if lastValue > 10× the max daily gain AND lastValue > 1,
        // it's the absolute total, not a gain.
        const lastIsAbsoluteTotal = lastValue > 1 && (dailyGains.length === 0 || lastValue > maxDailyGain * 10);

        if (lastIsAbsoluteTotal && lastValue > 0) {
          // Use the absolute total for the latest date, cumsum gains for earlier dates
          let cumulative = baseline;
          for (const metric of dailyGains) {
            const delta = metric.followers ?? 0;
            cumulative += delta;
            metric.followers = cumulative;
          }
          // Latest date gets the absolute total (or baseline if it's higher —
          // guard against regression to a suspiciously low value).
          lastEntry.followers = Math.max(lastValue, baseline);
          console.log(`[sync] LinkedIn cumsum: baseline=${baseline}, gains=${dailyGains.length}, absoluteTotal=${lastValue}, final=${lastEntry.followers}`);
        } else {
          // Standard cumsum: all values are daily gains
          let cumulative = baseline;
          for (const metric of sorted) {
            const delta = metric.followers ?? 0;
            cumulative += delta;
            metric.followers = cumulative;
          }
          // Guard: never regress below the baseline
          if (sorted.length > 0) {
            const finalValue = sorted[sorted.length - 1].followers ?? 0;
            if (finalValue < baseline && baseline > 0) {
              console.warn(`[sync] LinkedIn cumsum result (${finalValue}) < baseline (${baseline}), keeping baseline`);
              sorted[sorted.length - 1].followers = baseline;
            }
          }
          console.log(`[sync] LinkedIn cumsum: baseline=${baseline}, gains=${sorted.length}, final=${sorted[sorted.length - 1]?.followers}`);
        }
        result.dailyMetrics = sorted;

        const linkedinContentKeys = ["impressions", "reach", "engagements", "views", "likes", "comments", "shares"] as const;
        type LinkedInContentSnapshot = {
          date?: string | null;
          impressions?: number | null;
          reach?: number | null;
          engagements?: number | null;
          views?: number | null;
          likes?: number | null;
          comments?: number | null;
          shares?: number | null;
        };
        const hasContentSignals = sorted.some((metric) =>
          linkedinContentKeys.some((key) => coerceMetric(metric[key]) > 0)
        );

        // When DMA analytics is throttled (429), connector can return valid posts but
        // all content metrics as 0. Keep previous values instead of wiping history.
        if (!hasContentSignals && result.posts.length > 0) {
          const startDate = sorted[0]?.date;
          const endDate = sorted[sorted.length - 1]?.date;
          if (startDate && endDate) {
            const { data: existingRows, error: existingRowsError } = await supabase
              .from("social_daily_metrics")
              .select("date,impressions,reach,engagements,views,likes,comments,shares")
              .eq("tenant_id", tenantId)
              .eq("platform", account.platform)
              .eq("social_account_id", account.id)
              .gte("date", startDate)
              .lte("date", endDate);

            if (existingRowsError) {
              console.warn(`[sync] Failed to load existing LinkedIn daily metrics fallback: ${existingRowsError.message}`);
            } else {
              const existingByDate = new Map(
                (existingRows ?? []).map((row) => [String(row.date ?? ""), row as LinkedInContentSnapshot])
              );
              let restoredDays = 0;

              for (const metric of sorted) {
                const dateKey = String(metric.date ?? "");
                const existing = existingByDate.get(dateKey);
                if (!existing) continue;

                const incomingHasAny = linkedinContentKeys.some((key) => coerceMetric(metric[key]) > 0);
                if (incomingHasAny) continue;

                const existingHasAny = linkedinContentKeys.some((key) => coerceMetric(existing[key]) > 0);
                if (!existingHasAny) continue;

                for (const key of linkedinContentKeys) {
                  metric[key] = coerceMetric(existing[key]);
                }
                restoredDays++;
              }

              if (restoredDays > 0) {
                console.warn(`[sync] LinkedIn analytics fallback applied: restored content metrics on ${restoredDays} day(s)`);
              }
            }
          }
        }
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
        const failedPosts: string[] = [];

        for (const post of result.posts) {
          try {
            const externalPostId = String(post.external_post_id || `unknown_${Date.now()}`);
            const incomingMetrics = (post.metrics as Record<string, unknown> | null) ?? {};
            const existingMetrics = existingMetricsByExternalId.get(externalPostId) ?? {};
            const incomingHasAnyMetric = Object.values(incomingMetrics).some((value) => coerceMetric(value) > 0);
            const readMetric = (key: string) => {
              if (Object.prototype.hasOwnProperty.call(incomingMetrics, key)) {
                const incoming = coerceMetric(incomingMetrics[key]);
                if (
                  account.platform === "linkedin" &&
                  incoming === 0 &&
                  !incomingHasAnyMetric
                ) {
                  const existing = coerceMetric(existingMetrics[key]);
                  if (existing > 0) return existing;
                }
                return incoming;
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

      syncSucceeded = true;
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

  // After sync completes, snapshot the JumpStart Score
  if (syncSucceeded) {
    try {
      const periodDays = 30;
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - periodDays);
      const prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - periodDays);

      const [{ data: currentMetrics }, { data: prevMetrics }, currentPostsResult, prevPostsResult] = await Promise.all([
        supabase.from("social_daily_metrics")
          .select("followers,impressions,reach,engagements,views,posts_count,social_account_id,date")
          .eq("tenant_id", tenantId)
          .gte("date", start.toISOString().slice(0, 10))
          .lte("date", end.toISOString().slice(0, 10)),
        supabase.from("social_daily_metrics")
          .select("followers,impressions,reach,engagements,views,posts_count,social_account_id,date")
          .eq("tenant_id", tenantId)
          .gte("date", prevStart.toISOString().slice(0, 10))
          .lt("date", start.toISOString().slice(0, 10)),
        supabase.from("social_posts")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .gte("posted_at", start.toISOString())
          .lte("posted_at", end.toISOString()),
        supabase.from("social_posts")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .gte("posted_at", prevStart.toISOString())
          .lt("posted_at", start.toISOString()),
      ]);

      const sumMetrics = (rows: typeof currentMetrics) => {
        if (!rows?.length) return { followers: 0, views: 0, reach: 0, engagements: 0 };
        const latestFollowers = new Map<string, number>();
        let views = 0, reach = 0, engagements = 0;
        for (const r of rows) {
          views += coerceMetric(r.views);
          reach += coerceMetric(r.reach);
          engagements += coerceMetric(r.engagements);
          if (r.social_account_id) {
            const existing = latestFollowers.get(r.social_account_id);
            if (existing === undefined || (r.date && r.date > (existing.toString()))) {
              latestFollowers.set(r.social_account_id, coerceMetric(r.followers));
            }
          }
        }
        let followers = 0;
        for (const f of latestFollowers.values()) followers += f;
        return { followers, views, reach, engagements };
      };

      const current = sumMetrics(currentMetrics);
      const prev = sumMetrics(prevMetrics);

      const score = computeJumpStartScore({
        followers: current.followers,
        views: current.views,
        reach: current.reach,
        engagements: current.engagements,
        postsCount: currentPostsResult.count ?? 0,
        prevFollowers: prev.followers,
        prevViews: prev.views,
        prevReach: prev.reach,
        prevEngagements: prev.engagements,
        prevPostsCount: prevPostsResult.count ?? 0,
        periodDays,
      });

      await saveScoreSnapshot(tenantId, score, periodDays);
      console.log(`[sync] Score snapshot saved for ${tenantId}: ${score.global}/100 (${score.grade})`);
    } catch (scoreError) {
      console.warn("[sync] Failed to compute/save score snapshot:", scoreError);
    }
  }
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
