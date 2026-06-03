import { createSupabaseServiceClient, createSupabaseServerClient } from "@/lib/supabase/server";

export type StrategyProfile = {
  tenant_id: string;
  positioning: string | null;
  target_audience: string | null;
  offer_focus: string | null;
  brand_voice: string | null;
  editorial_pillars: string | null;
  current_quarter_objectives: string | null;
  monthly_focus: string | null;
  jumpstart_note: string | null;
  updated_at: string;
};

export type MonthlyStrategyBrief = {
  id: string;
  tenant_id: string;
  period_month: string;
  title: string;
  executive_summary: string | null;
  wins: string | null;
  learnings: string | null;
  next_focus: string | null;
  client_requests: string | null;
  jumpstart_actions: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type StrategyActionItem = {
  id: string;
  tenant_id: string;
  title: string;
  rationale: string | null;
  expected_impact: string | null;
  owner: "jumpstart" | "client" | "shared";
  status: "recommended" | "planned" | "in_progress" | "done" | "paused";
  priority: "low" | "medium" | "high" | "critical";
  due_date: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

export type ClientStrategySnapshot = {
  profile: StrategyProfile | null;
  latestBrief: MonthlyStrategyBrief | null;
  actionItems: StrategyActionItem[];
};

export async function fetchClientStrategySnapshot(params: {
  tenantId: string;
  admin?: boolean;
  includeDraftBriefs?: boolean;
}): Promise<ClientStrategySnapshot> {
  const supabase = params.admin ? createSupabaseServiceClient() : createSupabaseServerClient();

  const briefQuery = supabase
    .from("monthly_strategy_briefs")
    .select("*")
    .eq("tenant_id", params.tenantId)
    .order("period_month", { ascending: false })
    .limit(1);

  if (!params.includeDraftBriefs) {
    briefQuery.eq("is_published", true);
  }

  const [{ data: profile }, { data: briefs }, { data: actionItems }] = await Promise.all([
    supabase
      .from("client_strategy_profiles")
      .select("*")
      .eq("tenant_id", params.tenantId)
      .maybeSingle(),
    briefQuery,
    supabase
      .from("strategy_action_items")
      .select("*")
      .eq("tenant_id", params.tenantId)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  return {
    profile: (profile as StrategyProfile | null) ?? null,
    latestBrief: ((briefs ?? [])[0] as MonthlyStrategyBrief | undefined) ?? null,
    actionItems: (actionItems ?? []) as StrategyActionItem[],
  };
}

export function splitStrategyLines(value: string | null | undefined): string[] {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
