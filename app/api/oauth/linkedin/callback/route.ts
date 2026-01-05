import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/crypto";
import { handleLinkedInOAuthCallback } from "@/lib/social-platforms/linkedin/auth";
import type { SocialAccount } from "@/lib/social-platforms/core/types";

async function upsertSocialAccount(
  tenantId: string,
  account: SocialAccount,
  status: "active" | "pending" = "active"
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
    auth_status: status,
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
    console.error("[linkedin-callback] OAuth error:", { error: errorParam, description: errorDescription });
    return NextResponse.redirect(
      new URL(`/admin?linkedin_error=${encodeURIComponent(errorDescription || errorParam)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
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

    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error("[linkedin-callback] OAuth callback failed:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const redirectPath = tenantId ? `/admin/clients/${tenantId}` : "/admin";
    const redirectUrl = new URL(redirectPath, request.url);
    redirectUrl.searchParams.set("linkedin_error", errorMessage);

    return NextResponse.redirect(redirectUrl);
  }
}

export const runtime = "nodejs";
