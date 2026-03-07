/**
 * Data fetching for audience demographics
 */

import { createSupabaseServiceClient } from "@/lib/supabase/server";

export type DemographicEntry = {
  dimension: string;
  value: string;
  percentage: number;
  count?: number | null;
};

export type DemographicsData = {
  age: DemographicEntry[];
  gender: DemographicEntry[];
  country: DemographicEntry[];
  city: DemographicEntry[];
  // LinkedIn-specific dimensions
  function: DemographicEntry[];
  seniority: DemographicEntry[];
  industry: DemographicEntry[];
  platforms: string[];
  lastFetchedAt: string | null;
};

export async function fetchDemographics(
  tenantId: string
): Promise<DemographicsData> {
  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("audience_demographics")
    .select(
      "dimension,value,percentage,count,platform,fetched_at"
    )
    .eq("tenant_id", tenantId)
    .order("percentage", { ascending: false });

  if (error) {
    console.error("[demographics] Failed to fetch demographics", {
      tenantId,
      error,
    });
    return {
      age: [],
      gender: [],
      country: [],
      city: [],
      function: [],
      seniority: [],
      industry: [],
      platforms: [],
      lastFetchedAt: null,
    };
  }

  const rows = data ?? [];

  // Aggregate across all social accounts: sum percentages per dimension+value,
  // then re-normalize so each dimension totals 100%.
  const aggregated = new Map<
    string,
    Map<string, { percentage: number; count: number }>
  >();

  for (const row of rows) {
    const dim = row.dimension;
    if (!aggregated.has(dim)) {
      aggregated.set(dim, new Map());
    }
    const dimMap = aggregated.get(dim)!;
    const existing = dimMap.get(row.value) ?? { percentage: 0, count: 0 };
    existing.percentage += Number(row.percentage ?? 0);
    existing.count += Number(row.count ?? 0);
    dimMap.set(row.value, existing);
  }

  const buildEntries = (dimension: string): DemographicEntry[] => {
    const dimMap = aggregated.get(dimension);
    if (!dimMap || dimMap.size === 0) return [];

    const totalPct = Array.from(dimMap.values()).reduce(
      (sum, v) => sum + v.percentage,
      0
    );

    const entries: DemographicEntry[] = [];
    for (const [value, data] of dimMap) {
      entries.push({
        dimension,
        value,
        percentage:
          totalPct > 0
            ? Math.round((data.percentage / totalPct) * 1000) / 10
            : 0,
        count: data.count || null,
      });
    }

    return entries.sort((a, b) => b.percentage - a.percentage);
  };

  // Extract unique platforms
  const platforms = Array.from(
    new Set(rows.map((r) => r.platform).filter(Boolean))
  );

  // Find last fetched_at
  let lastFetchedAt: string | null = null;
  for (const row of rows) {
    const fetchedAt = row.fetched_at as string | null;
    if (fetchedAt && (!lastFetchedAt || fetchedAt > lastFetchedAt)) {
      lastFetchedAt = fetchedAt;
    }
  }

  return {
    age: buildEntries("age"),
    gender: buildEntries("gender"),
    country: buildEntries("country"),
    city: buildEntries("city"),
    function: buildEntries("function"),
    seniority: buildEntries("seniority"),
    industry: buildEntries("industry"),
    platforms,
    lastFetchedAt,
  };
}
