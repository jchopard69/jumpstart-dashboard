import assert from "node:assert/strict";
import { test } from "node:test";

import { computeDashboardDataQuality } from "../lib/dashboard-data-quality.ts";

const range = {
  start: new Date("2026-05-01T00:00:00.000Z"),
  end: new Date("2026-05-04T00:00:00.000Z"),
};

test("computeDashboardDataQuality reports platform coverage and stale sync actions", () => {
  const quality = computeDashboardDataQuality({
    range,
    accounts: [
      { id: "ig-1", platform: "instagram", account_name: "Instagram" },
      { id: "tt-1", platform: "tiktok", account_name: "TikTok" },
    ],
    metrics: [
      { date: "2026-05-01", platform: "instagram", views: 100, reach: 80, engagements: 10 },
      { date: "2026-05-02", platform: "instagram", views: 120, reach: 90, engagements: 12 },
      { date: "2026-05-03", platform: "instagram", views: 140, reach: 100, engagements: 14 },
      { date: "2026-05-04", platform: "instagram", views: 160, reach: 120, engagements: 16 },
      { date: "2026-05-01", platform: "tiktok", views: 200, reach: 0, engagements: 20 },
    ],
    perPlatform: [
      {
        platform: "instagram",
        available: { views: true, reach: true, engagements: true },
        totals: { followers: 1_000, views: 520, reach: 390, engagements: 52, posts_count: 4 },
      },
      {
        platform: "tiktok",
        available: { views: true, reach: true, engagements: true },
        totals: { followers: 500, views: 200, reach: 0, engagements: 20, posts_count: 1 },
      },
    ],
    lastSync: { status: "success", finished_at: "2026-05-01T00:00:00.000Z" },
  });

  assert.equal(quality.expectedDays, 4);
  assert.equal(quality.overallCoverage, 63);
  assert.equal(quality.platformQuality.find((item) => item.platform === "instagram")?.status, "good");
  assert.equal(quality.platformQuality.find((item) => item.platform === "tiktok")?.status, "partial");
  assert.deepEqual(
    quality.platformQuality.find((item) => item.platform === "tiktok")?.missingMetrics,
    ["reach"]
  );
  assert.equal(quality.staleSync, true);
  assert.ok(quality.actions.some((action) => action.includes("synchronisation")));
});

test("computeDashboardDataQuality treats absent metric rows as missing", () => {
  const quality = computeDashboardDataQuality({
    range,
    accounts: [{ id: "tt-1", platform: "tiktok", account_name: "TikTok" }],
    metrics: [],
    perPlatform: [
      {
        platform: "tiktok",
        available: { views: true, reach: true, engagements: true },
        totals: { followers: 0, views: 0, reach: 0, engagements: 0, posts_count: 0 },
      },
    ],
    lastSync: null,
  });

  assert.equal(quality.overallCoverage, 0);
  assert.equal(quality.platformQuality[0]?.status, "missing");
  assert.deepEqual(quality.platformQuality[0]?.missingMetrics, ["views", "reach", "engagements"]);
});
