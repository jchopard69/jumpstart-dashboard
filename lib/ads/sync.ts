import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/crypto";
import { fetchMetaCampaigns, fetchMetaCampaignDaily } from "@/lib/ads/meta";
import { fetchLinkedInAdAnalytics } from "@/lib/ads/linkedin";

export async function syncAdsForTenant(tenantId: string, lookbackDays = 30) {
  const supabase = createSupabaseServiceClient();
  const { data: adAccounts } = await supabase
    .from("ad_accounts")
    .select("id,platform,external_account_id,account_name,token_encrypted")
    .eq("tenant_id", tenantId);

  if (!adAccounts?.length) return [];

  const secret = process.env.ENCRYPTION_SECRET ?? "";
  if (!secret) {
    throw new Error("ENCRYPTION_SECRET is missing");
  }

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - lookbackDays);
  const since = sinceDate.toISOString().slice(0, 10);
  const until = new Date().toISOString().slice(0, 10);

  const results: Array<{ accountId: string; platform: string; campaigns: number; metrics: number }> = [];

  for (const account of adAccounts) {
    const token = account.token_encrypted ? decryptToken(account.token_encrypted, secret) : "";
    if (!token) continue;

    if (account.platform === "meta") {
      const campaigns = await fetchMetaCampaigns(token, account.external_account_id);
      if (campaigns.length) {
        await supabase.from("ad_campaigns").upsert(
          campaigns.map((campaign) => ({
            tenant_id: tenantId,
            ad_account_id: account.id,
            platform: "meta",
            external_campaign_id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            objective: campaign.objective,
            raw_json: campaign
          })),
          { onConflict: "tenant_id,platform,ad_account_id,external_campaign_id" }
        );
      }

      const daily = await fetchMetaCampaignDaily(token, account.external_account_id, since, until);
      if (daily.length) {
        await supabase.from("ad_campaign_metrics_daily").upsert(
          daily.map((row) => ({
            tenant_id: tenantId,
            platform: "meta",
            ad_account_id: account.id,
            external_campaign_id: row.campaignId,
            date: row.date,
            impressions: row.impressions,
            reach: row.reach,
            clicks: row.clicks,
            spend: row.spend,
            ctr: row.ctr,
            cpc: row.cpc,
            cpm: row.cpm,
            conversions: row.conversions,
            results: row.results,
            raw_json: row.raw
          })),
          { onConflict: "tenant_id,platform,ad_account_id,external_campaign_id,date" }
        );
      }

      await supabase
        .from("ad_accounts")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", account.id);

      results.push({ accountId: account.id, platform: account.platform, campaigns: campaigns.length, metrics: daily.length });
      continue;
    }

    if (account.platform === "linkedin") {
      const daily = await fetchLinkedInAdAnalytics(token, account.external_account_id, sinceDate, new Date());
      if (daily.length) {
        await supabase.from("ad_campaign_metrics_daily").upsert(
          daily.map((row) => ({
            tenant_id: tenantId,
            platform: "linkedin",
            ad_account_id: account.id,
            external_campaign_id: row.campaignId,
            date: row.date,
            impressions: row.impressions,
            reach: row.reach,
            clicks: row.clicks,
            spend: row.spend,
            conversions: row.conversions,
            results: row.results,
            raw_json: row.raw
          })),
          { onConflict: "tenant_id,platform,ad_account_id,external_campaign_id,date" }
        );
      }

      await supabase
        .from("ad_accounts")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", account.id);

      results.push({ accountId: account.id, platform: account.platform, campaigns: 0, metrics: daily.length });
    }
  }

  return results;
}
