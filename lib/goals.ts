/**
 * Tenant Goals — query and manage performance targets per client
 */

import { createSupabaseServiceClient } from "@/lib/supabase/server";

export type TenantGoals = {
  followers_target: number | null;
  engagement_rate_target: number | null;
  posts_per_week_target: number | null;
  reach_target: number | null;
  views_target: number | null;
  notes: string | null;
};

/**
 * Fetch goals for a tenant
 */
export async function fetchTenantGoals(tenantId: string): Promise<TenantGoals | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("tenant_goals")
    .select("followers_target,engagement_rate_target,posts_per_week_target,reach_target,views_target,notes")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    console.error("[goals] Failed to fetch:", error.message);
    return null;
  }

  return data as TenantGoals | null;
}
