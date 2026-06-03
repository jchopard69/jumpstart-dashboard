import { createSupabaseServerClient } from "./supabase/server";
import { buildClientPulse, type ClientPulse } from "./client-pulse-core";

export { buildClientPulse };
export type { ClientPulse };

export async function fetchClientPulse(tenantId: string): Promise<ClientPulse | null> {
  if (!tenantId) return null;
  const supabase = createSupabaseServerClient();

  const [
    { data: score },
    { count: unreadNotifications },
    { count: activeActions },
    { data: lastSync },
  ] = await Promise.all([
    supabase
      .from("score_snapshots")
      .select("global_score,grade,snapshot_date")
      .eq("tenant_id", tenantId)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_read", false),
    supabase
      .from("strategy_action_items")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("status", ["recommended", "planned", "in_progress"]),
    supabase
      .from("sync_logs")
      .select("status,finished_at")
      .eq("tenant_id", tenantId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return buildClientPulse({
    score: score?.global_score ?? null,
    grade: score?.grade ?? null,
    unreadNotifications: unreadNotifications ?? 0,
    activeActions: activeActions ?? 0,
    lastSyncStatus:
      lastSync?.status === "success" || lastSync?.status === "failed" || lastSync?.status === "running"
        ? lastSync.status
        : null,
    lastSyncAt: lastSync?.finished_at ?? null,
  });
}
