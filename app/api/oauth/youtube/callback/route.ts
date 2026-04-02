import { NextRequest, NextResponse } from "next/server";
import {
  handleYouTubeOAuthCallback,
  parseOAuthState,
} from "@/lib/social-platforms/youtube/auth";
import { clearOAuthCookies, readOAuthCookies } from "@/lib/social-platforms/core/oauth-cookies";
import { upsertSocialAccount } from "@/lib/social-platforms/core/db-utils";
import { requireAdminOAuthSession } from "@/lib/social-platforms/core/oauth-guard";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

function getRedirectBase(request: NextRequest, returnToOrigin?: string) {
  return returnToOrigin ? new URL(returnToOrigin) : new URL(request.url);
}

export async function GET(request: NextRequest) {
  const guard = await requireAdminOAuthSession(request, "youtube");
  if (guard) {
    clearOAuthCookies(guard, "youtube");
    return guard;
  }
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const stored = readOAuthCookies(request, "youtube");
  const parsedState = state
    ? (() => {
        try {
          return parseOAuthState(state);
        } catch {
          return null;
        }
      })()
    : null;
  const redirectBase = getRedirectBase(request, parsedState?.returnToOrigin);

  // Handle OAuth errors from Google
  if (errorParam) {
    console.error("[youtube-callback] OAuth error from Google:", { error: errorParam, description: errorDescription });
    const response = NextResponse.redirect(
      new URL(`/admin?youtube_error=${encodeURIComponent(errorDescription || errorParam)}`, redirectBase)
    );
    clearOAuthCookies(response, "youtube");
    return response;
  }

  if (!code || !state) {
    console.error("[youtube-callback] Missing code or state parameter");
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  const stateMatchesCookie = Boolean(stored.state) && stored.state === state;
  const stateHasServerSignature = Boolean(parsedState?.signed);

  if (!stateMatchesCookie && !stateHasServerSignature) {
    console.error("[youtube-callback] OAuth state mismatch or missing cookie", {
      hasCookie: Boolean(stored.state),
      hasSignedState: stateHasServerSignature,
    });
    const response = NextResponse.redirect(
      new URL(`/admin?youtube_error=${encodeURIComponent("OAuth state mismatch. Please retry.")}`, redirectBase)
    );
    clearOAuthCookies(response, "youtube");
    return response;
  }
  if (!stateMatchesCookie && stateHasServerSignature) {
    console.warn("[youtube-callback] OAuth state cookie missing; accepting signed state fallback");
  }

  let tenantId = "";
  let returnToOrigin = parsedState?.returnToOrigin;

  try {
    const result = await handleYouTubeOAuthCallback(code, state);
    tenantId = result.tenantId;
    returnToOrigin = result.returnToOrigin;

    // Verify tenant exists and is active
    const supabase = createSupabaseServiceClient();
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id,is_active")
      .eq("id", tenantId)
      .maybeSingle();
    if (!tenant || !tenant.is_active) {
      throw new Error("Tenant not found or inactive");
    }

    for (const account of result.accounts) {
      await upsertSocialAccount(tenantId, account);
    }

    console.log(`[youtube-callback] OAuth complete for tenant ${tenantId}:`, {
      accounts: result.accounts.map((account) => ({
        id: account.platformUserId,
        name: account.accountName,
      })),
    });

    const redirectUrl = new URL(`/admin/clients/${tenantId}`, getRedirectBase(request, returnToOrigin));
    redirectUrl.searchParams.set("youtube_success", "true");
    redirectUrl.searchParams.set("youtube_channel", result.accounts[0]?.accountName ?? "Chaîne YouTube");
    redirectUrl.searchParams.set("youtube_channels", String(result.accounts.length));

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
    const redirectUrl = new URL(redirectPath, getRedirectBase(request, returnToOrigin));
    redirectUrl.searchParams.set("youtube_error", errorMessage);

    const response = NextResponse.redirect(redirectUrl);
    clearOAuthCookies(response, "youtube");
    return response;
  }
}

export const runtime = "nodejs";
