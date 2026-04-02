/**
 * LinkedIn Community Management client for dashboard sync.
 */

import type { DemographicEntry } from "../../demographics-queries";
import type { Connector } from "../../connectors/types";

import {
  buildHeaders,
  fetchLinkedInDailyMetricsAndPosts,
  fetchLinkedInDemographics as fetchLinkedInCommunityDemographics,
  normalizeOrganizationId,
} from "./community";

export { buildHeaders, normalizeOrganizationId };

export const linkedinConnector: Connector = {
  platform: "linkedin",

  async sync({ externalAccountId, accessToken }) {
    if (!accessToken) {
      throw new Error("Missing LinkedIn access token");
    }

    const until = new Date();
    const since = new Date(until);
    since.setDate(since.getDate() - 29);

    return fetchLinkedInDailyMetricsAndPosts({
      externalAccountId,
      accessToken,
      since,
      until,
      postLimit: 50,
      includePostAnalytics: true,
      includeViews: true,
    });
  },
};

export async function fetchLinkedInDemographics(
  accessToken: string,
  organizationId: string
): Promise<DemographicEntry[]> {
  return fetchLinkedInCommunityDemographics(accessToken, organizationId);
}
