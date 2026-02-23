import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { getPostVisibility, getPostImpressions, getPostEngagements } from "@/lib/metrics";
import { decryptToken } from "@/lib/crypto";
import { buildUrl } from "@/lib/social-platforms/core/api-client";

const DEFAULT_META_VERSION = process.env.META_API_VERSION || "v25.0";
const METRIC_CANDIDATES = [
  "post_impressions",
  "post_impressions_unique",
  "post_media_view",
  "post_total_media_view_unique",
];

async function fetchMetricProbe(url: string) {
  const resp = await fetch(url);
  const body = await resp.json();
  return { status: resp.status, body: sanitizeDebugPayload(body) };
}

function sanitizeDebugPayload(payload: unknown): unknown {
  if (typeof payload === "string") {
    return payload.replace(/access_token=[^&\s]+/g, "access_token=[REDACTED]");
  }
  if (Array.isArray(payload)) {
    return payload.map(sanitizeDebugPayload);
  }
  if (payload && typeof payload === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      if (key === "access_token") {
        out[key] = "[REDACTED]";
      } else {
        out[key] = sanitizeDebugPayload(value);
      }
    }
    return out;
  }
  return payload;
}

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

  if (profile?.role !== "agency_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = searchParams.get("tenantId") || profile?.tenant_id;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

  const limit = Number(searchParams.get("limit") ?? "10");
  const postId = searchParams.get("postId");
  const externalPostId = searchParams.get("externalPostId");
  const platformFilter = searchParams.get("platform");

  let postsQuery = supabase
    .from("social_posts")
    .select("id,platform,caption,posted_at,metrics,media_type,external_post_id,social_account_id")
    .eq("tenant_id", tenantId)
    .order("posted_at", { ascending: false });

  if (postId) postsQuery = postsQuery.eq("id", postId);
  if (externalPostId) postsQuery = postsQuery.eq("external_post_id", externalPostId);
  if (platformFilter) postsQuery = postsQuery.eq("platform", platformFilter);

  const { data: posts, error } = await postsQuery.limit(Number.isFinite(limit) ? limit : 10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const versionParam = searchParams.get("versions");
  const versions = (versionParam
    ? versionParam.split(",").map((v) => v.trim()).filter(Boolean)
    : [DEFAULT_META_VERSION, "v25.0", "v24.0", "v23.0", "v21.0"])
    .filter((v, i, arr) => arr.indexOf(v) === i);

  // Try a live Facebook post insights call to diagnose metric availability
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

        const probes: Array<Record<string, unknown>> = [];
        for (const version of versions) {
          const graphUrl = `https://graph.facebook.com/${version}`;
          for (const metric of METRIC_CANDIDATES) {
            try {
              const url = buildUrl(`${graphUrl}/${postId}/insights/${metric}`, {
                period: "lifetime",
                access_token: token,
              });
              const probe = await fetchMetricProbe(url);
              probes.push({
                version,
                metric,
                status: probe.status,
                response: probe.body,
              });
            } catch (err) {
              probes.push({
                version,
                metric,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }
        }
        fbDiagnostic = {
          test: "individual_post_metric_probes",
          post_id: postId,
          probes,
        };
      }
    } catch (err) {
      fbDiagnostic = { error: "Could not get account token", details: err instanceof Error ? err.message : String(err) };
    }
  }

  // Optional: detailed diagnostics for all FB posts in selection
  const fbPostDiagnostics: Array<Record<string, unknown>> = [];
  if (searchParams.get("diagnosePosts") === "true") {
    const fbPosts = (posts ?? []).filter(p => p.platform === "facebook" && p.external_post_id && p.social_account_id);
    for (const post of fbPosts) {
      try {
        const { data: account } = await supabase
          .from("social_accounts")
          .select("token_encrypted")
          .eq("id", post.social_account_id)
          .single();

        if (!account?.token_encrypted) {
          fbPostDiagnostics.push({
            post_id: post.id,
            external_post_id: post.external_post_id,
            error: "Missing page token"
          });
          continue;
        }

        const secret = process.env.ENCRYPTION_SECRET || "";
        const token = decryptToken(account.token_encrypted, secret);
        const probeResults: Array<Record<string, unknown>> = [];
        for (const metric of METRIC_CANDIDATES) {
          const graphUrl = `https://graph.facebook.com/${DEFAULT_META_VERSION}`;
          const url = buildUrl(`${graphUrl}/${post.external_post_id}/insights/${metric}`, {
            period: "lifetime",
            access_token: token,
          });
          const probe = await fetchMetricProbe(url);
          probeResults.push({
            metric,
            status: probe.status,
            response: probe.body,
          });
        }

        fbPostDiagnostics.push({
          post_id: post.id,
          external_post_id: post.external_post_id,
          probes: probeResults,
        });
      } catch (err) {
        fbPostDiagnostics.push({
          post_id: post.id,
          external_post_id: post.external_post_id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
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
      visibility: getPostVisibility(p.metrics as any, p.media_type),
      impressions: getPostImpressions(p.metrics as any),
      engagements: getPostEngagements(p.metrics as any),
    }
  }));

  return NextResponse.json({
    tenant_id: tenantId,
    post_count: posts?.length ?? 0,
    posts: analysis,
    ...(fbDiagnostic ? { fb_diagnostic: fbDiagnostic } : {}),
    ...(fbPostDiagnostics.length ? { fb_post_diagnostics: fbPostDiagnostics } : {}),
  });
}

export const dynamic = "force-dynamic";
