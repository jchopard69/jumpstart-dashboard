/**
 * Notifications — detection & creation logic for alerts
 */

import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type NotificationType =
  | "sync_failure"
  | "account_disconnect"
  | "metric_drop"
  | "score_drop"
  | "info";

interface CreateNotificationParams {
  tenantId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Insert a notification row, skipping duplicates (same type + tenant in last 24h).
 */
export async function createNotification(
  supabase: SupabaseClient,
  { tenantId, type, title, message, metadata }: CreateNotificationParams
): Promise<void> {
  // Check for duplicate in last 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from("notifications")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("type", type)
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return; // duplicate — skip
  }

  const { error } = await supabase.from("notifications").insert({
    tenant_id: tenantId,
    type,
    title,
    message,
    metadata: metadata ?? {},
  });

  if (error) {
    console.error("[notifications] Failed to create notification:", error.message);
  }
}

/**
 * Run all alert detections for a tenant. Called after a sync completes.
 */
export async function detectAndCreateAlerts(tenantId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();

  await Promise.all([
    detectSyncFailures(supabase, tenantId),
    detectAccountDisconnects(supabase, tenantId),
    detectMetricDrop(supabase, tenantId),
    detectScoreDrop(supabase, tenantId),
  ]);
}

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

async function detectSyncFailures(
  supabase: SupabaseClient,
  tenantId: string
): Promise<void> {
  try {
    const { data: failedLogs } = await supabase
      .from("sync_logs")
      .select("id, social_account_id, error_message, platform")
      .eq("tenant_id", tenantId)
      .eq("status", "failed")
      .order("started_at", { ascending: false })
      .limit(5);

    if (!failedLogs?.length) return;

    // Resolve account names for the alert
    const accountIds = [...new Set(failedLogs.map((l) => l.social_account_id).filter(Boolean))];
    const accountNames = new Map<string, string>();
    if (accountIds.length) {
      const { data: accounts } = await supabase
        .from("social_accounts")
        .select("id, platform, external_account_id")
        .in("id", accountIds);
      for (const acc of accounts ?? []) {
        accountNames.set(acc.id, `${acc.platform} (${acc.external_account_id})`);
      }
    }

    // Create one alert for the most recent failure
    const latest = failedLogs[0];
    const name = accountNames.get(latest.social_account_id) ?? latest.platform ?? "Compte inconnu";

    await createNotification(supabase, {
      tenantId,
      type: "sync_failure",
      title: "Echec de synchronisation",
      message: `La synchronisation de ${name} a echoue. ${latest.error_message ? latest.error_message.slice(0, 200) : ""}`.trim(),
      metadata: {
        social_account_id: latest.social_account_id,
        platform: latest.platform,
        sync_log_id: latest.id,
      },
    });
  } catch (err) {
    console.warn("[notifications] detectSyncFailures error:", err);
  }
}

async function detectAccountDisconnects(
  supabase: SupabaseClient,
  tenantId: string
): Promise<void> {
  try {
    const { data: disconnected } = await supabase
      .from("social_accounts")
      .select("id, platform, external_account_id, auth_status")
      .eq("tenant_id", tenantId)
      .in("auth_status", ["expired", "revoked"]);

    if (!disconnected?.length) return;

    const names = disconnected
      .map((a) => `${a.platform} (${a.external_account_id})`)
      .join(", ");

    await createNotification(supabase, {
      tenantId,
      type: "account_disconnect",
      title: "Compte deconnecte",
      message: `${disconnected.length > 1 ? "Plusieurs comptes necessitent" : "Un compte necessite"} une reconnexion : ${names}`,
      metadata: {
        account_ids: disconnected.map((a) => a.id),
        platforms: disconnected.map((a) => a.platform),
      },
    });
  } catch (err) {
    console.warn("[notifications] detectAccountDisconnects error:", err);
  }
}

async function detectMetricDrop(
  supabase: SupabaseClient,
  tenantId: string
): Promise<void> {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const [{ data: recentMetrics }, { data: previousMetrics }] = await Promise.all([
      supabase
        .from("social_daily_metrics")
        .select("impressions")
        .eq("tenant_id", tenantId)
        .gte("date", sevenDaysAgo.toISOString().slice(0, 10))
        .lte("date", now.toISOString().slice(0, 10)),
      supabase
        .from("social_daily_metrics")
        .select("impressions")
        .eq("tenant_id", tenantId)
        .gte("date", fourteenDaysAgo.toISOString().slice(0, 10))
        .lt("date", sevenDaysAgo.toISOString().slice(0, 10)),
    ]);

    const sumImpressions = (rows: Array<{ impressions: number | null }> | null) =>
      (rows ?? []).reduce((sum, r) => sum + (r.impressions ?? 0), 0);

    const recent = sumImpressions(recentMetrics);
    const previous = sumImpressions(previousMetrics);

    // Only alert if we have meaningful previous data and drop > 30%
    if (previous > 0 && recent < previous * 0.7) {
      const dropPct = Math.round(((previous - recent) / previous) * 100);

      await createNotification(supabase, {
        tenantId,
        type: "metric_drop",
        title: "Baisse significative des impressions",
        message: `Les impressions ont baisse de ${dropPct}% cette semaine par rapport a la semaine precedente (${recent.toLocaleString("fr-FR")} vs ${previous.toLocaleString("fr-FR")}).`,
        metadata: {
          recent_impressions: recent,
          previous_impressions: previous,
          drop_percentage: dropPct,
        },
      });
    }
  } catch (err) {
    console.warn("[notifications] detectMetricDrop error:", err);
  }
}

async function detectScoreDrop(
  supabase: SupabaseClient,
  tenantId: string
): Promise<void> {
  try {
    const { data: snapshots } = await supabase
      .from("score_snapshots")
      .select("global_score, snapshot_date")
      .eq("tenant_id", tenantId)
      .order("snapshot_date", { ascending: false })
      .limit(2);

    if (!snapshots || snapshots.length < 2) return;

    const latest = snapshots[0].global_score;
    const previous = snapshots[1].global_score;
    const drop = previous - latest;

    if (drop > 10) {
      await createNotification(supabase, {
        tenantId,
        type: "score_drop",
        title: "Baisse du JumpStart Score",
        message: `Votre score est passe de ${previous} a ${latest} (-${drop} points).`,
        metadata: {
          latest_score: latest,
          previous_score: previous,
          drop_points: drop,
        },
      });
    }
  } catch (err) {
    console.warn("[notifications] detectScoreDrop error:", err);
  }
}
