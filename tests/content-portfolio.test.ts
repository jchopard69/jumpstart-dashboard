import assert from "node:assert/strict";
import { test } from "node:test";
import { buildContentPortfolio } from "../lib/content-portfolio.ts";

test("content portfolio summarizes dominant format and contributing platform", () => {
  const portfolio = buildContentPortfolio([
    {
      platform: "instagram",
      media_type: "reels",
      metrics: { views: 10000, engagements: 720 },
    },
    {
      platform: "instagram",
      media_type: "reels",
      metrics: { views: 8000, engagements: 520 },
    },
    {
      platform: "linkedin",
      media_type: "image",
      metrics: { impressions: 2500, engagements: 70 },
    },
  ]);

  assert.equal(portfolio.postsAnalyzed, 3);
  assert.equal(portfolio.dominantFormat, "Reels");
  assert.equal(portfolio.topPlatform, "Instagram");
  assert.equal(portfolio.qualityLabel, "Fort");
});

test("content portfolio handles periods without exploitable content metrics", () => {
  const portfolio = buildContentPortfolio([
    { platform: "tiktok", media_type: "video", metrics: {} },
  ]);

  assert.equal(portfolio.postsAnalyzed, 0);
  assert.equal(portfolio.dominantFormat, null);
  assert.equal(portfolio.qualityLabel, "Signal faible");
});
