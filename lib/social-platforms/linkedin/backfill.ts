import type { DailyMetric, PostMetric } from "../core/types";

import {
  fetchLinkedInDailyStatsRange,
  fetchLinkedInPosts,
} from "./dma";

const MAX_POSTS_BACKFILL = 200;

export async function fetchLinkedInDailyStats(params: {
  externalAccountId: string;
  accessToken: string;
  since: Date;
  until: Date;
}): Promise<DailyMetric[]> {
  return fetchLinkedInDailyStatsRange({
    ...params,
    includeViews: true,
  });
}

export async function fetchLinkedInPostsBackfill(params: {
  externalAccountId: string;
  accessToken: string;
  since: Date;
}): Promise<PostMetric[]> {
  return fetchLinkedInPosts({
    ...params,
    limit: MAX_POSTS_BACKFILL,
    includeAnalytics: false,
  });
}
