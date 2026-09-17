import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPlatformMix } from "../lib/platform-mix";

test("buildPlatformMix ranks channels by visibility and engagement contribution", () => {
  const mix = buildPlatformMix([
    {
      platform: "instagram",
      totals: { followers: 1000, views: 5000, reach: 3000, engagements: 600, posts_count: 8 },
    },
    {
      platform: "tiktok",
      totals: { followers: 500, views: 1000, reach: 0, engagements: 50, posts_count: 4 },
    },
  ]);

  assert.equal(mix.leader, "instagram");
  assert.equal(mix.items[0].platform, "instagram");
  assert.equal(mix.items[0].role, "Moteur relationnel");
  assert.equal(Math.round(mix.items[0].visibilityShare), 83);
  assert.equal(Math.round(mix.items[0].engagementShare), 92);
  assert.equal(mix.items[0].visibilityValue, 5000);
  assert.equal(mix.items[0].visibilityMetricLabel, "vues");
  assert.equal(mix.items[0].engagements, 600);
  assert.equal(mix.items[0].postsCount, 8);
});

test("buildPlatformMix labels balanced channel mixes", () => {
  const mix = buildPlatformMix([
    {
      platform: "instagram",
      totals: { followers: 1000, views: 1000, reach: 900, engagements: 100, posts_count: 2 },
    },
    {
      platform: "linkedin",
      totals: { followers: 900, views: 1000, reach: 900, engagements: 100, posts_count: 2 },
    },
  ]);

  assert.equal(mix.concentrationLabel, "Mix assumé");
});
