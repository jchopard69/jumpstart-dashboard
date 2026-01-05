import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveDateRange } from "@/lib/date";
import type { Platform } from "@/lib/types";

function toCsv(rows: Array<Record<string, any>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: any) => {
    const stringValue = String(value ?? "");
    if (stringValue.includes(",") || stringValue.includes("\n")) {
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
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id,role")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) {
    return NextResponse.json({ error: "Tenant missing" }, { status: 403 });
  }

  const preset = (searchParams.get("preset") ?? "last_30_days") as any;
  const range = resolveDateRange(preset, searchParams.get("from") ?? undefined, searchParams.get("to") ?? undefined);
  const platformParam = searchParams.get("platform");
  const platform = platformParam && platformParam !== "all" ? (platformParam as Platform) : null;

  let query = supabase
    .from("social_daily_metrics")
    .select("date,platform,followers,impressions,reach,engagements,likes,comments,shares,saves,views,watch_time,posts_count")
    .eq("tenant_id", profile.tenant_id)
    .gte("date", range.start.toISOString().slice(0, 10))
    .lte("date", range.end.toISOString().slice(0, 10))
    .order("date", { ascending: true });

  if (platform) {
    query = query.eq("platform", platform);
  }

  const { data } = await query;
  const csv = toCsv(data ?? []);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=daily-metrics.csv"
    }
  });
}

export const dynamic = "force-dynamic";
