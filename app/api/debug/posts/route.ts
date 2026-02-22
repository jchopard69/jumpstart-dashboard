import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedTenantId = searchParams.get("tenantId");

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id,role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "agency_admin";
  const tenantId = isAdmin && requestedTenantId ? requestedTenantId : profile?.tenant_id;

  if (!tenantId) {
    return NextResponse.json({ error: "Tenant non trouvé" }, { status: 403 });
  }

  const serviceClient = createSupabaseServiceClient();

  // Get all accounts for this tenant
  const { data: accounts } = await serviceClient
    .from("social_accounts")
    .select("id,platform,account_name,auth_status,last_sync_at")
    .eq("tenant_id", tenantId);

  // Get recent sync logs
  const { data: syncLogs } = await serviceClient
    .from("sync_logs")
    .select("id,platform,status,error_message,rows_upserted,started_at,finished_at")
    .eq("tenant_id", tenantId)
    .order("started_at", { ascending: false })
    .limit(10);

  // Get ALL posts (no date filter to debug)
  const { data: posts, count: postCount } = await serviceClient
    .from("social_posts")
    .select("id,platform,posted_at,caption,external_post_id", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("posted_at", { ascending: false })
    .limit(50);

  // Also check with date filter (last 30 days)
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count: last30DaysCount } = await serviceClient
    .from("social_posts")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("posted_at", since30);

  // Group posts by platform
  const postsByPlatform: Record<string, number> = {};
  for (const post of posts ?? []) {
    const platform = post.platform ?? "unknown";
    postsByPlatform[platform] = (postsByPlatform[platform] ?? 0) + 1;
  }

  return NextResponse.json({
    tenantId,
    accounts: accounts ?? [],
    syncLogs: syncLogs ?? [],
    postsSummary: {
      totalAllTime: postCount ?? 0,
      last30Days: last30DaysCount ?? 0,
      byPlatform: postsByPlatform,
      recent: (posts ?? []).slice(0, 10).map(p => ({
        id: p.id,
        platform: p.platform,
        posted_at: p.posted_at,
        caption: p.caption?.slice(0, 50)
      }))
    }
  });
}

export const dynamic = "force-dynamic";
