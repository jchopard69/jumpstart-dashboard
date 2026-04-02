/**
 * Score History — persist and query JumpStart Score snapshots
 */

import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { JumpStartScore } from "./scoring";

/**
 * Save a score snapshot for a tenant (upsert — one per day)
 */
export async function saveScoreSnapshot(
  tenantId: string,
  score: JumpStartScore,
  periodDays: number
): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from("score_snapshots").upsert(
    {
      tenant_id: tenantId,
      snapshot_date: today,
      global_score: score.global,
      grade: score.grade,
      sub_scores: score.subScores,
      period_days: periodDays,
    },
    { onConflict: "tenant_id,snapshot_date" }
  );

  if (error) {
    console.error("[score-history] Failed to save snapshot:", error.message);
  }
}

export type ScoreSnapshotRow = {
  snapshot_date: string;
  global_score: number;
  grade: string;
  sub_scores: Array<{ key: string; label: string; value: number; weight: number }>;
};

/**
 * Fetch score history for a tenant (last N months)
 */
export async function fetchScoreHistory(
  tenantId: string,
  months: number = 6
): Promise<ScoreSnapshotRow[]> {
  const supabase = createSupabaseServiceClient();
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const { data, error } = await supabase
    .from("score_snapshots")
    .select("snapshot_date,global_score,grade,sub_scores")
    .eq("tenant_id", tenantId)
    .gte("snapshot_date", since.toISOString().slice(0, 10))
    .order("snapshot_date", { ascending: true });

  if (error) {
    console.error("[score-history] Failed to fetch history:", error.message);
    return [];
  }

  return (data ?? []) as ScoreSnapshotRow[];
}
