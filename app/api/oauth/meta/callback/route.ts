import { NextRequest, NextResponse } from "next/server";
import { handleMetaOAuthCallback } from "@/lib/social-platforms/meta/auth";
import { clearOAuthCookies, readOAuthCookies } from "@/lib/social-platforms/core/oauth-cookies";
import { upsertSocialAccount } from "@/lib/social-platforms/core/db-utils";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const stored = readOAuthCookies(request, "meta");

  // Handle OAuth errors from Meta
  if (errorParam) {
    console.error("[meta-callback] OAuth error from Meta:", { error: errorParam, description: errorDescription });
    const response = NextResponse.redirect(
      new URL(`/admin?meta_error=${encodeURIComponent(errorDescription || errorParam)}`, request.url)
    );
    clearOAuthCookies(response, "meta");
    return response;
  }

  if (!code || !state) {
    console.error("[meta-callback] Missing code or state parameter");
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  if (!stored.state || stored.state !== state) {
    console.error("[meta-callback] OAuth state mismatch or missing cookie");
    const response = NextResponse.redirect(
      new URL(`/admin?meta_error=${encodeURIComponent("OAuth state mismatch. Please retry.")}`, request.url)
    );
    clearOAuthCookies(response, "meta");
    return response;
  }

  let tenantId = "";

  try {
    // Process the OAuth callback
    const result = await handleMetaOAuthCallback(code, state);
    tenantId = result.tenantId;

    // Save all accounts to database
    let facebookCount = 0;
    let instagramCount = 0;

    for (const account of result.accounts) {
      await upsertSocialAccount(tenantId, account);

      if (account.platform === "facebook") facebookCount++;
      if (account.platform === "instagram") instagramCount++;
    }

    console.log(`[meta-callback] OAuth complete for tenant ${tenantId}:`, {
      totalAccounts: result.accounts.length,
      facebook: facebookCount,
      instagram: instagramCount,
    });

    // Redirect back to admin with success message
    const redirectUrl = new URL(`/admin/clients/${tenantId}`, request.url);
    redirectUrl.searchParams.set("meta_success", "true");
    redirectUrl.searchParams.set("meta_pages", String(facebookCount));
    redirectUrl.searchParams.set("meta_ig", String(instagramCount));

    const response = NextResponse.redirect(redirectUrl);
    clearOAuthCookies(response, "meta");
    return response;

  } catch (error) {
    console.error("[meta-callback] OAuth callback failed:", {
      tenantId,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Determine appropriate redirect
    const redirectPath = tenantId
      ? `/admin/clients/${tenantId}`
      : "/admin";

    const redirectUrl = new URL(redirectPath, request.url);
    redirectUrl.searchParams.set("meta_error", errorMessage);

    // Add specific error codes for common issues
    if (errorMessage.includes("NO_PAGES_FOUND")) {
      redirectUrl.searchParams.set("meta_error_code", "no_pages");
    } else if (errorMessage.includes("PERMISSION_ERROR")) {
      redirectUrl.searchParams.set("meta_error_code", "permission_denied");
    } else if (errorMessage.includes("expired")) {
      redirectUrl.searchParams.set("meta_error_code", "token_expired");
    }

    const response = NextResponse.redirect(redirectUrl);
    clearOAuthCookies(response, "meta");
    return response;
  }
}

export const runtime = "nodejs";
