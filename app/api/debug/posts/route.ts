import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { getPostVisibility, getPostImpressions, getPostEngagements } from "@/lib/metrics";
import { decryptToken } from "@/lib/crypto";
import { apiRequest, buildUrl } from "@/lib/social-platforms/core/api-client";

const GRAPH_URL = "https://graph.facebook.com/v21.0";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const authClient = createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    .select("id,platform,caption,posted_at,metrics,media_type,external_post_id,social_account_id")
    .eq("tenant_id", tenantId)
    .order("posted_at", { ascending: false })
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Try a live Facebook post insights call to diagnose permission issues
  let fbDiagnostic: Record<string, unknown> | null = null;
  const firstFbPost = (posts ?? []).find(p => p.platform === "facebook");
  if (firstFbPost && searchParams.get("diagnose") === "true") {
    try {
      const { data: account } = await supabase
        .from("social_accounts")
        .select("token_encrypted")
        .eq("id", firstFbPost.social_account_id)
        .single();

      if (account?.token_encrypted) {
        const secret = process.env.ENCRYPTION_SECRET || "";
        const token = decryptToken(account.token_encrypted, secret);
        const postId = firstFbPost.external_post_id;

        // Test 1: individual post insight call
        try {
          const url = buildUrl(`${GRAPH_URL}/${postId}/insights`, {
            metric: "post_impressions,post_impressions_unique",
            period: "lifetime",
            access_token: token,
          });
          const resp = await fetch(url);
          const body = await resp.json();
          fbDiagnostic = {
            test: "individual_post_insights",
            post_id: postId,
            status: resp.status,
            response: body,
          };
        } catch (err) {
          fbDiagnostic = {
            test: "individual_post_insights",
            post_id: postId,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }
    } catch (err) {
      fbDiagnostic = { error: "Could not get account token", details: err instanceof Error ? err.message : String(err) };
    }
  }

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
    ...(fbDiagnostic ? { fb_diagnostic: fbDiagnostic } : {}),
  });
}

export const dynamic = "force-dynamic";
