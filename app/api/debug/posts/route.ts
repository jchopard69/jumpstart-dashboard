import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { getPostVisibility, getPostImpressions, getPostEngagements } from "@/lib/metrics";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const authClient = createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Use service client to bypass RLS (avoids stack depth limit)
  const supabase = createSupabaseServiceClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id,role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "agency_admin" && !profile?.tenant_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = searchParams.get("tenantId") || profile?.tenant_id;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

  const { data: posts, error } = await supabase
    .from("social_posts")
    .select("id,platform,caption,posted_at,metrics,media_type")
    .eq("tenant_id", tenantId)
    .order("posted_at", { ascending: false })
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const analysis = (posts ?? []).map(p => ({
    id: p.id,
    platform: p.platform,
    media_type: p.media_type,
    caption: (p.caption ?? "").slice(0, 40),
    posted_at: p.posted_at,
    raw_metrics: p.metrics,
    computed: {
      visibility: getPostVisibility(p.metrics as any),
      impressions: getPostImpressions(p.metrics as any),
      engagements: getPostEngagements(p.metrics as any),
    }
  }));

  return NextResponse.json({
    tenant_id: tenantId,
    post_count: posts?.length ?? 0,
    posts: analysis,
  });
}

export const dynamic = "force-dynamic";
