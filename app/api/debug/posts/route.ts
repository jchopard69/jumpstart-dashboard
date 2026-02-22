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
    .select("id,platform,posted_at,caption,external_post_id,social_account_id", { count: "exact" })
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

  // Check ALL social_accounts (including inactive/pending)
  const { data: allAccounts } = await serviceClient
    .from("social_accounts")
    .select("id,platform,account_name,auth_status,tenant_id")
    .eq("tenant_id", tenantId);

  // Check if there are posts for ANY tenant (global check)
  const { count: globalPostCount } = await serviceClient
    .from("social_posts")
    .select("id", { count: "exact", head: true });

  // Group posts by platform
  const postsByPlatform: Record<string, number> = {};
  for (const post of posts ?? []) {
    const platform = post.platform ?? "unknown";
    postsByPlatform[platform] = (postsByPlatform[platform] ?? 0) + 1;
  }

  // Try to insert a test post to diagnose the JSON issue
  let testInsertResult = null;
  const testAccountId = accounts?.[0]?.id;
  const testPlatform = accounts?.[0]?.platform || 'instagram';

  if (testAccountId) {
    try {
      const testPost = {
        tenant_id: tenantId,
        platform: testPlatform,
        social_account_id: testAccountId,
        external_post_id: `test_${Date.now()}`,
        posted_at: new Date().toISOString(),
        url: 'https://example.com/test',
        caption: 'Test caption with emoji 🎉 and special chars: "quotes" & ampersand',
        media_type: 'image',
        thumbnail_url: null,
        media_url: null,
        metrics: { likes: 1, comments: 2, shares: 0, views: 0, engagements: 3, impressions: 0 },
        raw_json: null
      };
      const { error } = await serviceClient.from("social_posts").insert(testPost);
      if (error) {
        testInsertResult = { success: false, error: error.message, code: error.code, testPost };
      } else {
        testInsertResult = { success: true, message: "Test post inserted successfully" };
        // Clean up test post
        await serviceClient.from("social_posts").delete().eq("external_post_id", testPost.external_post_id);
      }
    } catch (e: any) {
      testInsertResult = { success: false, error: e.message };
    }
  } else {
    testInsertResult = { skipped: true, reason: "No accounts found" };
  }

  return NextResponse.json({
    tenantId,
    accounts: accounts ?? [],
    allAccounts: allAccounts ?? [],
    syncLogs: syncLogs ?? [],
    testInsertResult,
    postsSummary: {
      totalAllTime: postCount ?? 0,
      last30Days: last30DaysCount ?? 0,
      globalPostCount: globalPostCount ?? 0,
      byPlatform: postsByPlatform,
      recent: (posts ?? []).slice(0, 10).map(p => ({
        id: p.id,
        platform: p.platform,
        posted_at: p.posted_at,
        social_account_id: p.social_account_id,
        caption: p.caption?.slice(0, 50)
      }))
    }
  });
}

export const dynamic = "force-dynamic";
