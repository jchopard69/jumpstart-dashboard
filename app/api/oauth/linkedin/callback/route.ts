import { NextRequest, NextResponse } from "next/server";
import { handleLinkedInOAuthCallback } from "@/lib/social-platforms/linkedin/auth";
import { clearOAuthCookies, readOAuthCookies } from "@/lib/social-platforms/core/oauth-cookies";
import { upsertSocialAccount } from "@/lib/social-platforms/core/db-utils";
import { requireAdminOAuthSession } from "@/lib/social-platforms/core/oauth-guard";

export async function GET(request: NextRequest) {
  const guard = await requireAdminOAuthSession(request, "linkedin");
  if (guard) {
    clearOAuthCookies(guard, "linkedin");
    return guard;
  }
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const stored = readOAuthCookies(request, "linkedin");

  if (errorParam) {
    console.error("[linkedin-callback] OAuth error:", { error: errorParam, description: errorDescription });
    const response = NextResponse.redirect(
      new URL(`/admin?linkedin_error=${encodeURIComponent(errorDescription || errorParam)}`, request.url)
    );
    clearOAuthCookies(response, "linkedin");
    return response;
  }

  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  if (!stored.state || stored.state !== state) {
    console.error("[linkedin-callback] OAuth state mismatch or missing cookie");
    const response = NextResponse.redirect(
      new URL(`/admin?linkedin_error=${encodeURIComponent("OAuth state mismatch. Please retry.")}`, request.url)
    );
    clearOAuthCookies(response, "linkedin");
    return response;
  }

  let tenantId = "";

  try {
    const result = await handleLinkedInOAuthCallback(code, state);
    tenantId = result.tenantId;

    let orgCount = 0;

    for (const account of result.accounts) {
      await upsertSocialAccount(tenantId, account, "pending");

      const metadata = account.metadata as { accountType?: string } | undefined;
      if (metadata?.accountType === 'organization') {
        orgCount++;
      }
    }

    console.log(`[linkedin-callback] OAuth complete for tenant ${tenantId}:`, {
      organizations: orgCount,
    });

    const redirectUrl = new URL(`/admin/clients/${tenantId}/linkedin/select`, request.url);
    redirectUrl.searchParams.set("linkedin_success", "true");
    redirectUrl.searchParams.set("linkedin_accounts", String(result.accounts.length));

    const response = NextResponse.redirect(redirectUrl);
    clearOAuthCookies(response, "linkedin");
    return response;

  } catch (error) {
    console.error("[linkedin-callback] OAuth callback failed:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const redirectPath = tenantId ? `/admin/clients/${tenantId}` : "/admin";
    const redirectUrl = new URL(redirectPath, request.url);
    redirectUrl.searchParams.set("linkedin_error", errorMessage);

    const response = NextResponse.redirect(redirectUrl);
    clearOAuthCookies(response, "linkedin");
    return response;
  }
}

export const runtime = "nodejs";
