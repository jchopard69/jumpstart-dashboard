import { NextRequest, NextResponse } from "next/server";
import { handleYouTubeOAuthCallback } from "@/lib/social-platforms/youtube/auth";
import { clearOAuthCookies, readOAuthCookies } from "@/lib/social-platforms/core/oauth-cookies";
import { upsertSocialAccount } from "@/lib/social-platforms/core/db-utils";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const stored = readOAuthCookies(request, "youtube");

  // Handle OAuth errors from Google
  if (errorParam) {
    console.error("[youtube-callback] OAuth error from Google:", { error: errorParam, description: errorDescription });
    const response = NextResponse.redirect(
      new URL(`/admin?youtube_error=${encodeURIComponent(errorDescription || errorParam)}`, request.url)
    );
    clearOAuthCookies(response, "youtube");
    return response;
  }

  if (!code || !state) {
    console.error("[youtube-callback] Missing code or state parameter");
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  if (!stored.state || stored.state !== state) {
    console.error("[youtube-callback] OAuth state mismatch or missing cookie");
    const response = NextResponse.redirect(
      new URL(`/admin?youtube_error=${encodeURIComponent("OAuth state mismatch. Please retry.")}`, request.url)
    );
    clearOAuthCookies(response, "youtube");
    return response;
  }

  let tenantId = "";

  try {
    const result = await handleYouTubeOAuthCallback(code, state);
    tenantId = result.tenantId;

    await upsertSocialAccount(tenantId, result.account);

    console.log(`[youtube-callback] OAuth complete for tenant ${tenantId}: ${result.account.accountName}`);

    const redirectUrl = new URL(`/admin/clients/${tenantId}`, request.url);
    redirectUrl.searchParams.set("youtube_success", "true");
    redirectUrl.searchParams.set("youtube_channel", result.account.accountName);

    const response = NextResponse.redirect(redirectUrl);
    clearOAuthCookies(response, "youtube");
    return response;

  } catch (error) {
    console.error("[youtube-callback] OAuth callback failed:", {
      tenantId,
      error: error instanceof Error ? error.message : error,
    });

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const redirectPath = tenantId ? `/admin/clients/${tenantId}` : "/admin";
    const redirectUrl = new URL(redirectPath, request.url);
    redirectUrl.searchParams.set("youtube_error", errorMessage);

    const response = NextResponse.redirect(redirectUrl);
    clearOAuthCookies(response, "youtube");
    return response;
  }
}

export const runtime = "nodejs";
