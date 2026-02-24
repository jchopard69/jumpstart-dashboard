import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/crypto";
import { apiRequest } from "@/lib/social-platforms/core/api-client";
import { LINKEDIN_CONFIG, getLinkedInVersion } from "@/lib/social-platforms/linkedin/config";

type DebugResponse = {
  account?: {
    id: string;
    platform: string;
    external_account_id: string;
  };
  token_suffix?: string;
  org_acls?: unknown;
  follower_trend?: unknown;
  content_analytics?: unknown;
  feed_contents?: unknown;
  error?: string;
};

type DebugAttempt = {
  url: string;
  ok: boolean;
  data?: unknown;
  error?: string;
};

const API_URL = LINKEDIN_CONFIG.apiUrl;
const API_VERSION = getLinkedInVersion();

async function tryLinkedIn<T>(url: string, headers: Record<string, string>): Promise<DebugAttempt> {
  try {
    const data = await apiRequest<T>("linkedin", url, { headers }, "linkedin_debug", true);
    return { url, ok: true, data };
  } catch (error) {
    return {
      url,
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

export async function GET(request: Request) {
  const debugSecret = request.headers.get("x-debug-secret");
  if (!process.env.CRON_SECRET || debugSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const socialAccountId = searchParams.get("socialAccountId");
  if (!socialAccountId) {
    return NextResponse.json({ error: "Missing socialAccountId" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "agency_admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const service = createSupabaseServiceClient();
  const { data: account, error: accountError } = await service
    .from("social_accounts")
    .select("id,platform,external_account_id,token_encrypted")
    .eq("id", socialAccountId)
    .single();

  if (accountError || !account) {
    return NextResponse.json({ error: "Social account not found" }, { status: 404 });
  }

  if (account.platform !== "linkedin") {
    return NextResponse.json({ error: "LinkedIn account required" }, { status: 400 });
  }

  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    console.error("[debug/linkedin] ENCRYPTION_SECRET not configured");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const accessToken = account.token_encrypted ? decryptToken(account.token_encrypted, secret) : "";
  if (!accessToken) {
    return NextResponse.json({ error: "Access token missing" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "X-Restli-Protocol-Version": "2.0.0"
  };
  if (API_VERSION) {
    headers["LinkedIn-Version"] = API_VERSION;
  }

  const orgId = account.external_account_id;
  const pageUrn = `urn:li:organizationalPage:${orgId}`;

  const response: DebugResponse = {
    account: {
      id: account.id,
      platform: account.platform,
      external_account_id: orgId
    },
    token_suffix: accessToken.slice(-6)
  };

  try {
    // Test dmaOrganizationAcls (DMA endpoint for org discovery)
    const orgAclsAttempt = await tryLinkedIn(
      `${API_URL}/dmaOrganizationAcls?q=roleAssignee&role=(value:ADMINISTRATOR)&state=(value:APPROVED)&start=0&count=10`,
      headers
    );
    response.org_acls = orgAclsAttempt;

    // Test DMA follower trend (last 7 days)
    const start = new Date();
    start.setDate(start.getDate() - 7);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);

    const followerAttempt = await tryLinkedIn(
      `${API_URL}/dmaOrganizationalPageEdgeAnalytics` +
        `?q=trend&organizationalPage=${encodeURIComponent(pageUrn)}` +
        `&analyticsType=FOLLOWER` +
        `&timeIntervals=(timeRange:(start:${start.getTime()},end:${end.getTime()}))`,
      headers
    );
    response.follower_trend = followerAttempt;

    // Test DMA content analytics (last 7 days)
    const contentAttempt = await tryLinkedIn(
      `${API_URL}/dmaOrganizationalPageContentAnalytics` +
        `?q=trend&sourceEntity=${encodeURIComponent(pageUrn)}` +
        `&metricTypes=List(IMPRESSIONS,UNIQUE_IMPRESSIONS,CLICKS,COMMENTS,REACTIONS,REPOSTS)` +
        `&timeIntervals=(timeRange:(start:${start.getTime()},end:${end.getTime()}),timeGranularityType:DAY)`,
      headers
    );
    response.content_analytics = contentAttempt;

    // Test DMA feed contents (q=postsByAuthor, author=List(orgUrn))
    const orgUrn = `urn:li:organization:${orgId}`;
    const feedAttempt = await tryLinkedIn(
      `${API_URL}/dmaFeedContentsExternal` +
        `?q=postsByAuthor&author=List(${encodeURIComponent(orgUrn)})&maxPaginationCount=5`,
      headers
    );
    response.feed_contents = feedAttempt;
  } catch (error) {
    response.error = error instanceof Error ? error.message : "Unknown error";
  }

  return NextResponse.json(response);
}

export const runtime = "nodejs";
