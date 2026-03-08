import { createSupabaseServiceClient } from "@/lib/supabase/server";

export type NotificationType = "sync_failure" | "account_disconnect" | "metric_drop" | "score_drop" | "info";

/**
 * Create a tenant notification with basic deduplication to avoid spamming.
 *
 * Dedup strategy: if a notification with the same (tenant_id, type, title) was
 * created in the last `dedupeWindowMinutes`, skip.
 */
export async function createTenantNotification(params: {
  tenantId: string;
  type: NotificationType;
  title: string;
  message?: string | null;
  metadata?: Record<string, unknown>;
  dedupeWindowMinutes?: number;
}) {
  const {
    tenantId,
    type,
    title,
    message = null,
    metadata = {},
    dedupeWindowMinutes = 360,
  } = params;

  const supabase = createSupabaseServiceClient();

  // Best-effort dedupe (avoid spamming on repeated cron failures)
  try {
    const since = new Date(Date.now() - dedupeWindowMinutes * 60 * 1000).toISOString();
    const { data: existing, error: existingError } = await supabase
      .from("notifications")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("type", type)
      .eq("title", title)
      .gte("created_at", since)
      .limit(1);

    if (!existingError && (existing?.length ?? 0) > 0) {
      return;
    }
  } catch {
    // ignore
  }

  try {
    await supabase
      .from("notifications")
      .insert({
        tenant_id: tenantId,
        type,
        title,
        message,
        metadata,
      });
  } catch {
    // Best-effort: never fail the main flow because notifications failed
  }
}
