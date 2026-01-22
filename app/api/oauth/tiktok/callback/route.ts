import { NextRequest, NextResponse } from "next/server";
import { handleTikTokOAuthCallback } from "@/lib/social-platforms/tiktok/auth";
import { clearOAuthCookies, readOAuthCookies } from "@/lib/social-platforms/core/oauth-cookies";
import { upsertSocialAccount } from "@/lib/social-platforms/core/db-utils";
import { requireAdminOAuthSession } from "@/lib/social-platforms/core/oauth-guard";

export async function GET(request: NextRequest) {
  const guard = await requireAdminOAuthSession(request, "tiktok");
  if (guard) {
    clearOAuthCookies(guard, "tiktok");
    return guard;
  }
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const stored = readOAuthCookies(request, "tiktok");

  // Handle OAuth errors from TikTok
  if (errorParam) {
    console.error("[tiktok-callback] OAuth error from TikTok:", { error: errorParam, description: errorDescription });
    const response = NextResponse.redirect(
      new URL(`/admin?tiktok_error=${encodeURIComponent(errorDescription || errorParam)}`, request.url)
    );
    clearOAuthCookies(response, "tiktok");
    return response;
  }

  if (!code || !state) {
    console.error("[tiktok-callback] Missing code or state parameter");
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  if (!stored.state || stored.state !== state || !stored.codeVerifier) {
    console.error("[tiktok-callback] OAuth state mismatch or missing verifier");
    const response = NextResponse.redirect(
      new URL(`/admin?tiktok_error=${encodeURIComponent("OAuth state mismatch. Please retry.")}`, request.url)
    );
    clearOAuthCookies(response, "tiktok");
    return response;
  }

  let tenantId = "";

  try {
    const result = await handleTikTokOAuthCallback(code, state, stored.codeVerifier);
    tenantId = result.tenantId;

    await upsertSocialAccount(tenantId, result.account);

    console.log(`[tiktok-callback] OAuth complete for tenant ${tenantId}: ${result.account.accountName}`);

    const redirectUrl = new URL(`/admin/clients/${tenantId}`, request.url);
    redirectUrl.searchParams.set("tiktok_success", "true");
    redirectUrl.searchParams.set("tiktok_account", result.account.accountName);

    const response = NextResponse.redirect(redirectUrl);
    clearOAuthCookies(response, "tiktok");
    return response;

  } catch (error) {
    console.error("[tiktok-callback] OAuth callback failed:", {
      tenantId,
      error: error instanceof Error ? error.message : error,
    });

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const redirectPath = tenantId ? `/admin/clients/${tenantId}` : "/admin";
    const redirectUrl = new URL(redirectPath, request.url);
    redirectUrl.searchParams.set("tiktok_error", errorMessage);

    const response = NextResponse.redirect(redirectUrl);
    clearOAuthCookies(response, "tiktok");
    return response;
  }
}

export const runtime = "nodejs";
