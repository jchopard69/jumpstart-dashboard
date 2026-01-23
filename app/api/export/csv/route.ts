import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { resolveDateRange, buildPreviousRange } from "@/lib/date";
import type { Platform } from "@/lib/types";

function toCsv(rows: Array<Record<string, any>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: any) => {
    const stringValue = String(value ?? "");
    if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };
  const headerLine = headers.join(",");
  const lines = rows.map((row) => headers.map((header) => escape(row[header])).join(","));
  return [headerLine, ...lines].join("\n");
}

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

  // Handle agency_admin accessing client data via tenantId param
  const isAdmin = profile.role === "agency_admin" && searchParams.get("tenantId");
  const tenantId = isAdmin ? searchParams.get("tenantId")! : profile.tenant_id;

  if (!tenantId) {
    return Response.json({ error: "Tenant missing" }, { status: 403 });
  }

  // Use service client for admin access to bypass RLS
  const dbClient = isAdmin ? createSupabaseServiceClient() : supabase;

  const { data: tenant } = await dbClient
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
  const prevRange = buildPreviousRange(range);

  const platformParam = searchParams.get("platform");
  const platform =
    platformParam && platformParam !== "all" ? (platformParam as Platform) : null;

  // Build queries for current and previous period
  let query = dbClient
    .from("social_daily_metrics")
    .select(
      "date,platform,followers,impressions,reach,engagements,views,watch_time,posts_count"
    )
    .eq("tenant_id", tenantId)
    .gte("date", range.start.toISOString().slice(0, 10))
    .lte("date", range.end.toISOString().slice(0, 10))
    .order("date", { ascending: true });

  if (platform) {
    query = query.eq("platform", platform);
  }

  const { data, error } = await query;

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

  // Format data for CSV export
  const csvRows = data.map((row) => ({
    Date: row.date,
    Plateforme: row.platform,
    Abonnés: row.followers ?? 0,
    Impressions: row.impressions ?? 0,
    Portée: row.reach ?? 0,
    Engagements: row.engagements ?? 0,
    Vues: row.views ?? 0,
    "Temps de visionnage (min)": row.watch_time ? Math.round(row.watch_time / 60) : 0,
    Publications: row.posts_count ?? 0,
  }));

  const csv = toCsv(csvRows);
  const filename = `${tenant?.name ?? "export"}-metrics-${range.start.toISOString().slice(0, 10)}-${range.end.toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export const dynamic = "force-dynamic";
