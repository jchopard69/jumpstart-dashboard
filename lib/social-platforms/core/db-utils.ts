/**
 * Database utilities for social accounts
 */

import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/crypto";
import { assertTenantNotDemoWritable } from "@/lib/demo";
import type { SocialAccount } from "./types";

/**
 * Upsert a social account in the database
 * This function handles both creation and update of social accounts
 */
export async function upsertSocialAccount(
  tenantId: string,
  account: SocialAccount,
  status: "active" | "pending" = "active"
): Promise<void> {
  const supabase = createSupabaseServiceClient();
  await assertTenantNotDemoWritable(tenantId, "oauth_upsert_social_account", supabase);
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

    console.log(`[db-utils] Updated existing account: ${account.platform}/${account.accountName}`);
  } else {
    // Insert new account
    const { error: insertError } = await supabase
      .from("social_accounts")
      .insert(accountData);

    if (insertError) {
      throw new Error(`Failed to insert account: ${insertError.message}`);
    }

    console.log(`[db-utils] Created new account: ${account.platform}/${account.accountName}`);
  }
}
