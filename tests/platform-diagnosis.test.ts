import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPlatformDiagnosis } from "../lib/platform-diagnosis.ts";
import type { PlatformData } from "../lib/types/dashboard.ts";

function platform(overrides: Partial<PlatformData>): PlatformData {
  return {
    platform: "instagram",
    available: { views: true, reach: true, engagements: true },
    totals: { followers: 0, views: 0, reach: 0, engagements: 0, posts_count: 0 },
    delta: { followers: 0, views: 0, reach: 0, engagements: 0, posts_count: 0 },
    ...overrides,
  };
}

test("platform diagnosis identifies the channel driving engagement and visibility", () => {
  const diagnosis = buildPlatformDiagnosis([
    platform({
      platform: "instagram",
      totals: { followers: 4000, views: 22000, reach: 18000, engagements: 1600, posts_count: 8 },
      delta: { followers: 2, views: 8, reach: 6, engagements: 11, posts_count: 0 },
    }),
    platform({
      platform: "tiktok",
      totals: { followers: 2500, views: 9000, reach: 7000, engagements: 320, posts_count: 6 },
      delta: { followers: 1, views: -4, reach: -6, engagements: -12, posts_count: 0 },
    }),
  ]);

  assert.equal(diagnosis.primary?.platform, "instagram");
  assert.match(diagnosis.primary?.detail ?? "", /des engagements/);
  assert.equal(diagnosis.balance?.value, "Concentré");
});

test("platform diagnosis flags connected channels with missing reach data", () => {
  const diagnosis = buildPlatformDiagnosis([
    platform({
      platform: "instagram",
      totals: { followers: 4000, views: 12000, reach: 11000, engagements: 900, posts_count: 5 },
    }),
    platform({
      platform: "tiktok",
      available: { views: true, reach: false, engagements: true },
      totals: { followers: 2000, views: 8000, reach: 0, engagements: 420, posts_count: 5 },
    }),
  ]);

  assert.equal(diagnosis.watch?.platform, "tiktok");
  assert.match(diagnosis.watch?.detail ?? "", /Portée indisponible/);
});
