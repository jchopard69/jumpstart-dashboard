import assert from "node:assert/strict";
import { test } from "node:test";

import { buildDashboardActionPlan } from "../lib/dashboard-action-plan.ts";
import type { DashboardDataQuality } from "../lib/dashboard-data-quality.ts";

const goodQuality: DashboardDataQuality = {
  overallCoverage: 100,
  expectedDays: 30,
  staleSync: false,
  platformQuality: [
    {
      platform: "instagram",
      accounts: 1,
      coveredDays: 30,
      expectedDays: 30,
      coverage: 100,
      status: "good",
      missingMetrics: [],
    },
  ],
  actions: [],
};

test("buildDashboardActionPlan prioritizes broken data before content recommendations", () => {
  const actions = buildDashboardActionPlan({
    totals: { followers: 1_000, views: 10_000, reach: 8_000, engagements: 600, posts_count: 12 },
    prevTotals: { followers: 900, views: 8_000, reach: 7_000, engagements: 500, posts_count: 10 },
    platforms: [
      {
        platform: "instagram",
        totals: { followers: 1_000, views: 10_000, reach: 8_000, engagements: 600, posts_count: 12 },
      },
    ],
    periodDays: 30,
    dataQuality: {
      ...goodQuality,
      overallCoverage: 0,
      staleSync: true,
      platformQuality: [
        {
          platform: "tiktok",
          accounts: 1,
          coveredDays: 0,
          expectedDays: 30,
          coverage: 0,
          status: "missing",
          missingMetrics: ["views", "reach", "engagements"],
        },
      ],
    },
  });

  assert.equal(actions[0]?.id, "data-tiktok");
  assert.equal(actions[0]?.priority, "high");
});

test("buildDashboardActionPlan flags missed engagement and cadence targets", () => {
  const actions = buildDashboardActionPlan({
    totals: { followers: 1_000, views: 10_000, reach: 8_000, engagements: 150, posts_count: 4 },
    prevTotals: { followers: 950, views: 9_000, reach: 7_500, engagements: 250, posts_count: 8 },
    platforms: [
      {
        platform: "instagram",
        totals: { followers: 1_000, views: 10_000, reach: 8_000, engagements: 150, posts_count: 4 },
      },
    ],
    periodDays: 28,
    goals: {
      followers_target: null,
      engagement_rate_target: 3,
      posts_per_week_target: 3,
      reach_target: null,
      views_target: null,
      notes: null,
    },
    dataQuality: goodQuality,
  });

  assert.ok(actions.some((action) => action.id === "engagement-target"));
  assert.ok(actions.some((action) => action.id === "publishing-rhythm"));
});

test("buildDashboardActionPlan recommends scaling a strong platform when data is healthy", () => {
  const actions = buildDashboardActionPlan({
    totals: { followers: 2_000, views: 8_000, reach: 6_000, engagements: 500, posts_count: 10 },
    prevTotals: { followers: 1_950, views: 7_000, reach: 5_500, engagements: 450, posts_count: 10 },
    platforms: [
      {
        platform: "linkedin",
        totals: { followers: 1_000, views: 0, reach: 2_000, engagements: 160, posts_count: 4 },
      },
      {
        platform: "instagram",
        totals: { followers: 1_000, views: 6_000, reach: 4_000, engagements: 180, posts_count: 6 },
      },
    ],
    periodDays: 30,
    dataQuality: {
      ...goodQuality,
      platformQuality: [
        { ...goodQuality.platformQuality[0]!, platform: "linkedin" },
        { ...goodQuality.platformQuality[0]!, platform: "instagram" },
      ],
    },
  });

  assert.ok(actions.some((action) => action.id === "scale-linkedin"));
});
