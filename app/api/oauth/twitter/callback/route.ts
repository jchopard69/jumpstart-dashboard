import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/crypto";
import { handleTwitterOAuthCallback } from "@/lib/social-platforms/twitter/auth";
import type { SocialAccount } from "@/lib/social-platforms/core/types";

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
  } else {
    const { error: insertError } = await supabase
      .from("social_accounts")
      .insert(accountData);

    if (insertError) {
      throw new Error(`Failed to insert account: ${insertError.message}`);
    }
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (errorParam) {
    console.error("[twitter-callback] OAuth error:", { error: errorParam, description: errorDescription });
    return NextResponse.redirect(
      new URL(`/admin?twitter_error=${encodeURIComponent(errorDescription || errorParam)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  let tenantId = "";

  try {
    const result = await handleTwitterOAuthCallback(code, state);
    tenantId = result.tenantId;

    await upsertSocialAccount(tenantId, result.account);

    console.log(`[twitter-callback] OAuth complete for tenant ${tenantId}: ${result.account.accountName}`);

    const redirectUrl = new URL(`/admin/clients/${tenantId}`, request.url);
    redirectUrl.searchParams.set("twitter_success", "true");
    redirectUrl.searchParams.set("twitter_account", result.account.accountUsername || result.account.accountName);

    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error("[twitter-callback] OAuth callback failed:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const redirectPath = tenantId ? `/admin/clients/${tenantId}` : "/admin";
    const redirectUrl = new URL(redirectPath, request.url);
    redirectUrl.searchParams.set("twitter_error", errorMessage);

    return NextResponse.redirect(redirectUrl);
  }
}

export const runtime = "nodejs";
