import assert from "node:assert/strict";
import { test } from "node:test";

import { buildDashboardOpportunities } from "../lib/dashboard-opportunities.ts";

test("dashboard opportunities detect engagement and visibility winners", () => {
  const opportunities = buildDashboardOpportunities([
    {
      platform: "tiktok",
      media_type: "video",
      url: "https://example.com/tiktok",
      metrics: { view_count: 90_000, like_count: 600, comment_count: 35, share_count: 80 },
    },
    {
      platform: "instagram",
      media_type: "image",
      url: "https://example.com/instagram",
      metrics: { impression_count: 18_000, like_count: 1_400, comments_count: 180, save_count: 210 },
    },
  ]);

  assert.equal(opportunities.length, 2);
  assert.equal(opportunities[0].id, "replicate-engagement-winner");
  assert.equal(opportunities[0].href, "https://example.com/instagram");
  assert.equal(opportunities[1].id, "amplify-visibility-winner");
  assert.equal(opportunities[1].href, "https://example.com/tiktok");
});

test("dashboard opportunities stay hidden when metrics are unavailable", () => {
  const opportunities = buildDashboardOpportunities([
    { platform: "linkedin", media_type: "text", metrics: {} },
  ]);

  assert.deepEqual(opportunities, []);
});
