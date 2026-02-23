import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  // Debug routes require CRON_SECRET header
  const debugSecret = request.headers.get("x-debug-secret");
  if (!process.env.CRON_SECRET || debugSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,role,tenant_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const requestedTenantId = searchParams.get("tenantId");
  const tenantId = profile.role === "agency_admin" && requestedTenantId
    ? requestedTenantId
    : profile.tenant_id;

  if (!tenantId) {
    return NextResponse.json({ error: "No tenant" }, { status: 400 });
  }

  const [metricsCount, postsCount, accountsCount] = await Promise.all([
    supabase
      .from("social_daily_metrics")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("social_posts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("social_accounts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
  ]);

  return NextResponse.json({
    user_id: user.id,
    role: profile.role,
    tenant_id: tenantId,
    counts: {
      social_accounts: accountsCount.count ?? 0,
      social_daily_metrics: metricsCount.count ?? 0,
      social_posts: postsCount.count ?? 0
    },
    errors: {
      social_accounts: accountsCount.error?.message ?? null,
      social_daily_metrics: metricsCount.error?.message ?? null,
      social_posts: postsCount.error?.message ?? null
    }
  });
}

export const dynamic = "force-dynamic";
