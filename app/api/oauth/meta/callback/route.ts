import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/crypto";
import { handleMetaOAuthCallback } from "@/lib/social-platforms/meta/auth";
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
    // Update existing account
    const { error: updateError } = await supabase
      .from("social_accounts")
      .update({
        account_name: accountData.account_name,
        auth_status: accountData.auth_status,
        token_encrypted: accountData.token_encrypted,
        refresh_token_encrypted: accountData.refresh_token_encrypted,
        token_expires_at: accountData.token_expires_at,
        last_sync_at: null, // Reset to trigger fresh sync
      })
      .eq("id", existing.id);

    if (updateError) {
      throw new Error(`Failed to update account: ${updateError.message}`);
    }

    console.log(`[meta-callback] Updated existing account: ${account.platform}/${account.accountName}`);
  } else {
    // Insert new account
    const { error: insertError } = await supabase
      .from("social_accounts")
      .insert(accountData);

    if (insertError) {
      throw new Error(`Failed to insert account: ${insertError.message}`);
    }

    console.log(`[meta-callback] Created new account: ${account.platform}/${account.accountName}`);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle OAuth errors from Meta
  if (errorParam) {
    console.error("[meta-callback] OAuth error from Meta:", { error: errorParam, description: errorDescription });
    return NextResponse.redirect(
      new URL(`/admin?meta_error=${encodeURIComponent(errorDescription || errorParam)}`, request.url)
    );
  }

  if (!code || !state) {
    console.error("[meta-callback] Missing code or state parameter");
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
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

    return NextResponse.redirect(redirectUrl);

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

    return NextResponse.redirect(redirectUrl);
  }
}

export const runtime = "nodejs";
