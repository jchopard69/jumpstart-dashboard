import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { resolveActiveTenantId } from "@/lib/auth";
import { resolveDateRange, toIsoDate } from "@/lib/date";
import { buildMetricCsvRows, toCsv } from "@/lib/csv-export";
import type { Platform } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,role,tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return Response.json({ error: "Profile missing" }, { status: 403 });
  }

  const tenantId = await resolveActiveTenantId(profile, searchParams.get("tenantId"));
  if (!tenantId) {
    return Response.json({ error: "Tenant missing" }, { status: 403 });
  }

  const dataClient =
    profile.role === "agency_admin" && Boolean(searchParams.get("tenantId"))
      ? createSupabaseServiceClient()
      : supabase;

  const { data: tenant } = await dataClient
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .single();

  const preset = (searchParams.get("preset") ?? "last_30_days") as any;
  const range = resolveDateRange(
    preset,
    searchParams.get("from") ?? undefined,
    searchParams.get("to") ?? undefined
  );

  const platformParam = searchParams.get("platform");
  const platform =
    platformParam && platformParam !== "all" ? (platformParam as Platform) : null;
  const accountId = searchParams.get("accountId");

  let query = dataClient
    .from("social_daily_metrics")
    .select(
      "date,platform,social_account_id,followers,impressions,reach,engagements,views,watch_time,posts_count"
    )
    .eq("tenant_id", tenantId)
    .gte("date", toIsoDate(range.start))
    .lte("date", toIsoDate(range.end))
    .order("date", { ascending: true });

  if (platform) {
    query = query.eq("platform", platform);
  }
  if (accountId) {
    query = query.eq("social_account_id", accountId);
  }

  const [{ data, error }, { data: accounts }, { data: lastSync }] = await Promise.all([
    query,
    dataClient
      .from("social_accounts")
      .select("id,account_name")
      .eq("tenant_id", tenantId),
    dataClient
      .from("sync_logs")
      .select("status,finished_at")
      .eq("tenant_id", tenantId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (error) {
    console.error("[csv] query failed", error);
    return Response.json({ error: "Failed to fetch data" }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return new Response("Aucune donnée pour la période sélectionnée", {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const msDay = 24 * 60 * 60 * 1000;
  const expectedDays = Math.max(1, Math.ceil((range.end.getTime() - range.start.getTime()) / msDay) + 1);
  const csvRows = buildMetricCsvRows({
    rows: data,
    accounts: accounts ?? [],
    expectedDays,
    lastSync,
  });

  const csv = toCsv(csvRows);
  const safeName = (tenant?.name ?? "export")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const filename = `${safeName || "export"}-metrics-${toIsoDate(range.start)}-${toIsoDate(range.end)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export const dynamic = "force-dynamic";
