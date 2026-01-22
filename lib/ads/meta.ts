import { apiRequest, buildUrl } from "@/lib/social-platforms/core/api-client";
import { META_CONFIG } from "@/lib/social-platforms/meta/config";

export type MetaCampaign = {
  id: string;
  name?: string;
  status?: string;
  objective?: string;
};

export type MetaCampaignDaily = {
  campaignId: string;
  date: string;
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  results: number;
  raw: Record<string, unknown>;
};

const CONVERSION_ACTIONS = [
  "offsite_conversion",
  "purchase",
  "omni_purchase",
  "lead",
  "app_install",
  "complete_registration"
];

function normalizeAdAccountId(adAccountId: string) {
  return adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
}

function sumActionValues(actions: Array<Record<string, string>> | undefined, filter?: (type: string) => boolean) {
  if (!actions?.length) return 0;
  return actions.reduce((total, action) => {
    const type = action.action_type || "";
    if (filter && !filter(type)) return total;
    const value = Number(action.value ?? 0);
    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
}

export async function fetchMetaCampaigns(accessToken: string, adAccountId: string) {
  const accountId = normalizeAdAccountId(adAccountId);
  const url = buildUrl(`${META_CONFIG.graphUrl}/${accountId}/campaigns`, {
    fields: "id,name,status,objective",
    limit: 200,
    access_token: accessToken
  });

  const response = await apiRequest<{ data?: MetaCampaign[] }>(
    "facebook",
    url,
    {},
    "meta_ads_campaigns"
  );

  return response.data ?? [];
}

export async function fetchMetaCampaignDaily(
  accessToken: string,
  adAccountId: string,
  since: string,
  until: string
) {
  const accountId = normalizeAdAccountId(adAccountId);
  const url = buildUrl(`${META_CONFIG.graphUrl}/${accountId}/insights`, {
    level: "campaign",
    time_increment: 1,
    time_range: JSON.stringify({ since, until }),
    fields: "campaign_id,campaign_name,impressions,reach,clicks,spend,ctr,cpc,cpm,actions",
    access_token: accessToken
  });

  const response = await apiRequest<{ data?: Array<Record<string, string>> }>(
    "facebook",
    url,
    {},
    "meta_ads_insights"
  );

  return (response.data ?? []).map((row) => {
    const actions = (row.actions as unknown as Array<Record<string, string>>) ?? [];
    const conversions = sumActionValues(actions, (type) =>
      CONVERSION_ACTIONS.some((label) => type.includes(label))
    );
    const results = sumActionValues(actions);

    return {
      campaignId: row.campaign_id,
      date: row.date_start,
      impressions: Number(row.impressions ?? 0),
      reach: Number(row.reach ?? 0),
      clicks: Number(row.clicks ?? 0),
      spend: Number(row.spend ?? 0),
      ctr: Number(row.ctr ?? 0),
      cpc: Number(row.cpc ?? 0),
      cpm: Number(row.cpm ?? 0),
      conversions,
      results,
      raw: row
    };
  });
}
