import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/crypto";
import { handleYouTubeOAuthCallback } from "@/lib/social-platforms/youtube/auth";
import type { SocialAccount } from "@/lib/social-platforms/core/types";

/**
 * Upsert a social account in the database
 */
async function upsertSocialAccount(
  tenantId: string,
  account: SocialAccount
): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const secret = process.env.ENCRYPTION_SECRET;

  if (!secret) {
    throw new Error("ENCRYPTION_SECRET is not configured");
  }

  const tokenEncrypted = encryptToken(account.accessToken, secret);
  const refreshTokenEncrypted = account.refreshToken
    ? encryptToken(account.refreshToken, secret)
    : null;

  const accountData = {
    tenant_id: tenantId,
    platform: account.platform,
    account_name: account.accountName,
    external_account_id: account.platformUserId,
    auth_status: "active" as const,
    token_encrypted: tokenEncrypted,
    refresh_token_encrypted: refreshTokenEncrypted,
    token_expires_at: account.tokenExpiresAt?.toISOString() ?? null,
  };

  // Check if account already exists
  const { data: existing, error: existingError } = await supabase
    .from("social_accounts")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("platform", account.platform)
    .eq("external_account_id", account.platformUserId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Database error: ${existingError.message}`);
  }

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("social_accounts")
      .update({
        account_name: accountData.account_name,
        auth_status: accountData.auth_status,
        token_encrypted: accountData.token_encrypted,
        refresh_token_encrypted: accountData.refresh_token_encrypted,
        token_expires_at: accountData.token_expires_at,
        last_sync_at: null,
      })
      .eq("id", existing.id);

    if (updateError) {
      throw new Error(`Failed to update account: ${updateError.message}`);
    }

    console.log(`[youtube-callback] Updated existing account: ${account.accountName}`);
  } else {
    const { error: insertError } = await supabase
      .from("social_accounts")
      .insert(accountData);

    if (insertError) {
      throw new Error(`Failed to insert account: ${insertError.message}`);
    }

    console.log(`[youtube-callback] Created new account: ${account.accountName}`);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle OAuth errors from Google
  if (errorParam) {
    console.error("[youtube-callback] OAuth error from Google:", { error: errorParam, description: errorDescription });
    return NextResponse.redirect(
      new URL(`/admin?youtube_error=${encodeURIComponent(errorDescription || errorParam)}`, request.url)
    );
  }

  if (!code || !state) {
    console.error("[youtube-callback] Missing code or state parameter");
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
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

    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error("[youtube-callback] OAuth callback failed:", {
      tenantId,
      error: error instanceof Error ? error.message : error,
    });

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const redirectPath = tenantId ? `/admin/clients/${tenantId}` : "/admin";
    const redirectUrl = new URL(redirectPath, request.url);
    redirectUrl.searchParams.set("youtube_error", errorMessage);

    return NextResponse.redirect(redirectUrl);
  }
}

export const runtime = "nodejs";
