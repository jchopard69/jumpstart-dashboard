import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/crypto";
import { apiRequest, buildUrl } from "@/lib/social-platforms/core/api-client";
import { META_CONFIG } from "@/lib/social-platforms/meta/config";

type DebugResponse = {
  account?: {
    id: string;
    platform: string;
    external_account_id: string;
  };
  token_suffix?: string;
  account_info?: unknown;
  insights?: unknown;
  debug_token?: unknown;
  error?: string;
};

function resolveDateParam(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed;
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

  if (account.platform !== "instagram") {
    return NextResponse.json({ error: "Instagram account required" }, { status: 400 });
  }

  const secret = process.env.ENCRYPTION_SECRET ?? "";
  if (!secret) {
    return NextResponse.json({ error: "ENCRYPTION_SECRET is missing" }, { status: 500 });
  }

  const accessToken = account.token_encrypted ? decryptToken(account.token_encrypted, secret) : "";
  if (!accessToken) {
    return NextResponse.json({ error: "Access token missing" }, { status: 400 });
  }

  const response: DebugResponse = {
    account: {
      id: account.id,
      platform: account.platform,
      external_account_id: account.external_account_id
    },
    token_suffix: accessToken.slice(-6)
  };

  const fromParam = resolveDateParam(searchParams.get("from"), new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const toParam = resolveDateParam(searchParams.get("to"), new Date());
  const since = Math.floor(fromParam.getTime() / 1000);
  const until = Math.floor(toParam.getTime() / 1000);

  try {
    const accountInfoUrl = buildUrl(`${META_CONFIG.graphUrl}/${account.external_account_id}`, {
      fields: "id,username,media_count,followers_count",
      access_token: accessToken
    });
    response.account_info = await apiRequest("instagram", accountInfoUrl, {}, "account_info");

    const timeSeriesUrl = buildUrl(`${META_CONFIG.graphUrl}/${account.external_account_id}/insights`, {
      metric: META_CONFIG.instagramTimeSeriesMetrics.join(","),
      period: "day",
      since,
      until,
      access_token: accessToken
    });
    const totalUrl = buildUrl(`${META_CONFIG.graphUrl}/${account.external_account_id}/insights`, {
      metric: META_CONFIG.instagramTotalValueMetrics.join(","),
      period: "day",
      metric_type: "total_value",
      since,
      until,
      access_token: accessToken
    });
    response.insights = {
      time_series: await apiRequest("instagram", timeSeriesUrl, {}, "insights_time_series"),
      total_value: await apiRequest("instagram", totalUrl, {}, "insights_total")
    };

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (appId && appSecret) {
      const appToken = `${appId}|${appSecret}`;
      const debugUrl = buildUrl(`${META_CONFIG.graphUrl}/debug_token`, {
        input_token: accessToken,
        access_token: appToken
      });
      response.debug_token = await apiRequest("facebook", debugUrl, {}, "debug_token");
    }
  } catch (error) {
    response.error = error instanceof Error ? error.message : "Unknown error";
  }

  return NextResponse.json(response);
}

export const runtime = "nodejs";
