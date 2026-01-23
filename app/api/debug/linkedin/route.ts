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
  follower_stats?: Record<string, unknown>;
  share_stats?: Record<string, unknown>;
  shares?: unknown;
  error?: string;
};

type DebugAttempt = {
  url: string;
  ok: boolean;
  error?: string;
};

const API_URL = LINKEDIN_CONFIG.apiUrl;
const API_VERSION = getLinkedInVersion();

function buildTimeIntervalsSingle(start: Date, end: Date) {
  return `(timeRange:(start:${start.getTime()},end:${end.getTime()}),timeGranularityType:DAY)`;
}

function buildDotParams(start: Date, end: Date) {
  return new URLSearchParams({
    "timeIntervals.timeRange.start": String(start.getTime()),
    "timeIntervals.timeRange.end": String(end.getTime()),
    "timeIntervals.timeGranularityType": "DAY"
  }).toString();
}

async function tryLinkedIn<T>(url: string, headers: Record<string, string>) {
  try {
    const data = await apiRequest<T>("linkedin", url, { headers }, "linkedin_debug", true);
    return { data, attempt: { url, ok: true } as DebugAttempt };
  } catch (error) {
    return {
      data: null,
      attempt: {
        url,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error"
      } as DebugAttempt
    };
  }
}

export async function GET(request: Request) {
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

  const secret = process.env.ENCRYPTION_SECRET ?? "";
  if (!secret) {
    return NextResponse.json({ error: "ENCRYPTION_SECRET is missing" }, { status: 500 });
  }

  const accessToken = account.token_encrypted ? decryptToken(account.token_encrypted, secret) : "";
  if (!accessToken) {
    return NextResponse.json({ error: "Access token missing" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`
  };
  if (API_VERSION) {
    headers["LinkedIn-Version"] = API_VERSION;
  }

  const response: DebugResponse = {
    account: {
      id: account.id,
      platform: account.platform,
      external_account_id: account.external_account_id
    },
    token_suffix: accessToken.slice(-6)
  };

  try {
    const orgAclsUrl = `${API_URL}/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED`;
    const orgAcls = await apiRequest("linkedin", orgAclsUrl, { headers }, "organization_acls", true);
    response.org_acls = orgAcls;

    const start = new Date();
    start.setDate(start.getDate() - 7);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);

    const baseStatsUrl = `${API_URL}/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${account.external_account_id}`;
    const baseShareUrl = `${API_URL}/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${account.external_account_id}`;

    const statsAttempts: DebugAttempt[] = [];
    const shareAttempts: DebugAttempt[] = [];

    const singleStats = await tryLinkedIn(`${baseStatsUrl}&timeIntervals=${buildTimeIntervalsSingle(start, end)}`, headers);
    statsAttempts.push(singleStats.attempt);
    const dotStats = await tryLinkedIn(`${baseStatsUrl}&${buildDotParams(start, end)}`, headers);
    statsAttempts.push(dotStats.attempt);

    response.follower_stats = { attempts: statsAttempts };

    const singleShare = await tryLinkedIn(`${baseShareUrl}&timeIntervals=${buildTimeIntervalsSingle(start, end)}`, headers);
    shareAttempts.push(singleShare.attempt);
    const dotShare = await tryLinkedIn(`${baseShareUrl}&${buildDotParams(start, end)}`, headers);
    shareAttempts.push(dotShare.attempt);

    response.share_stats = { attempts: shareAttempts };

    const sharesUrl = `${LINKEDIN_CONFIG.apiV2Url ?? "https://api.linkedin.com/v2"}/shares` +
      `?q=owners&owners=urn:li:organization:${account.external_account_id}` +
      `&count=10&sharesPerOwner=10&projection=(elements*(id,created,commentary,text,content,specificContent))`;
    response.shares = await apiRequest("linkedin", sharesUrl, { headers }, "shares_debug", true);
  } catch (error) {
    response.error = error instanceof Error ? error.message : "Unknown error";
  }

  return NextResponse.json(response);
}

export const runtime = "nodejs";
