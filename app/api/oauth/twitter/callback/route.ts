import { NextRequest, NextResponse } from "next/server";
import { handleTwitterOAuthCallback } from "@/lib/social-platforms/twitter/auth";
import { clearOAuthCookies, readOAuthCookies } from "@/lib/social-platforms/core/oauth-cookies";
import { upsertSocialAccount } from "@/lib/social-platforms/core/db-utils";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const stored = readOAuthCookies(request, "twitter");

  if (errorParam) {
    console.error("[twitter-callback] OAuth error:", { error: errorParam, description: errorDescription });
    const response = NextResponse.redirect(
      new URL(`/admin?twitter_error=${encodeURIComponent(errorDescription || errorParam)}`, request.url)
    );
    clearOAuthCookies(response, "twitter");
    return response;
  }

  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  if (!stored.state || stored.state !== state || !stored.codeVerifier) {
    console.error("[twitter-callback] OAuth state mismatch or missing verifier");
    const response = NextResponse.redirect(
      new URL(`/admin?twitter_error=${encodeURIComponent("OAuth state mismatch. Please retry.")}`, request.url)
    );
    clearOAuthCookies(response, "twitter");
    return response;
  }

  let tenantId = "";

  try {
    const result = await handleTwitterOAuthCallback(code, state, stored.codeVerifier);
    tenantId = result.tenantId;

    await upsertSocialAccount(tenantId, result.account);

    console.log(`[twitter-callback] OAuth complete for tenant ${tenantId}: ${result.account.accountName}`);

    const redirectUrl = new URL(`/admin/clients/${tenantId}`, request.url);
    redirectUrl.searchParams.set("twitter_success", "true");
    redirectUrl.searchParams.set("twitter_account", result.account.accountUsername || result.account.accountName);

    const response = NextResponse.redirect(redirectUrl);
    clearOAuthCookies(response, "twitter");
    return response;

  } catch (error) {
    console.error("[twitter-callback] OAuth callback failed:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const redirectPath = tenantId ? `/admin/clients/${tenantId}` : "/admin";
    const redirectUrl = new URL(redirectPath, request.url);
    redirectUrl.searchParams.set("twitter_error", errorMessage);

    const response = NextResponse.redirect(redirectUrl);
    clearOAuthCookies(response, "twitter");
    return response;
  }
}

export const runtime = "nodejs";
