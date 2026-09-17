import assert from "node:assert/strict";
import { test } from "node:test";
import { getDashboardMetricAvailability } from "../lib/dashboard-metric-availability";

test("TikTok views stored in the legacy reach column never expose a reach metric", () => {
  const result = getDashboardMetricAvailability("tiktok",
    { views: 15000, reach: 15000, engagements: 400 },
    { views: 12000, reach: 12000, engagements: 300 });
  assert.equal(result.reach, false);
  assert.equal(result.views, true);
});

test("linkedin exposes reach and engagements by default in the dashboard", () => {
  assert.deepEqual(
    getDashboardMetricAvailability(
      "linkedin",
      { views: 0, reach: 0, engagements: 0 },
      { views: 0, reach: 0, engagements: 0 }
    ),
    {
      views: false,
      reach: true,
      engagements: true,
    }
  );
});

test("historical data still makes a metric available when defaults do not", () => {
  assert.deepEqual(
    getDashboardMetricAvailability(
      "twitter",
      { views: 0, reach: 0, engagements: 0 },
      { views: 12, reach: 0, engagements: 4 }
    ),
    {
      views: true,
      reach: false,
      engagements: true,
    }
  );
});
