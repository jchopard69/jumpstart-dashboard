/**
 * Demographics sync: fetch and upsert audience demographic data for a tenant.
 */

import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/crypto";
import { getValidAccessToken } from "@/lib/social-platforms/core/token-manager";
import { fetchMetaDemographics } from "@/lib/social-platforms/meta/api";
import { fetchLinkedInDemographics } from "@/lib/social-platforms/linkedin/api";
import type { DemographicEntry } from "@/lib/demographics-queries";
import type { Platform } from "@/lib/types";

export async function syncDemographics(tenantId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();

  const { data: accounts, error } = await supabase
    .from("social_accounts")
    .select(
      "id,tenant_id,platform,external_account_id,token_encrypted,refresh_token_encrypted"
    )
    .eq("tenant_id", tenantId)
    .eq("auth_status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(
      "[demographics-sync] Failed to fetch social accounts",
      error.message
    );
    return;
  }

  if (!accounts?.length) {
    return;
  }

  const secret = process.env.ENCRYPTION_SECRET;

  for (const account of accounts) {
    try {
      let accessToken: string | null = null;

      if (account.token_encrypted) {
        accessToken = await getValidAccessToken(account.id);
      }

      if (!accessToken) {
        continue;
      }

      let entries: DemographicEntry[] = [];
      const platform = account.platform as Platform;

      if (platform === "instagram") {
        entries = await fetchMetaDemographics(
          accessToken,
          account.external_account_id
        );
      } else if (platform === "linkedin") {
        entries = await fetchLinkedInDemographics(
          accessToken,
          account.external_account_id
        );
      } else {
        // Other platforms not yet supported for demographics
        continue;
      }

      if (entries.length === 0) {
        continue;
      }

      const now = new Date().toISOString();
      const payload = entries.map((entry) => ({
        tenant_id: tenantId,
        social_account_id: account.id,
        platform: platform,
        dimension: entry.dimension,
        value: entry.value,
        percentage: entry.percentage,
        count: entry.count ?? null,
        fetched_at: now,
      }));

      const { error: upsertError } = await supabase
        .from("audience_demographics")
        .upsert(payload, {
          onConflict:
            "tenant_id,social_account_id,platform,dimension,value",
        });

      if (upsertError) {
        console.error(
          `[demographics-sync] Failed to upsert demographics for ${platform} account ${account.id}:`,
          upsertError.message
        );
      } else {
        console.log(
          `[demographics-sync] Upserted ${entries.length} demographic entries for ${platform} account ${account.id}`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[demographics-sync] Error syncing demographics for account ${account.id} (${account.platform}):`,
        message
      );
      // Continue to next account
    }
  }
}
