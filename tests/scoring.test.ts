import assert from "node:assert/strict";
import { test } from "node:test";

import { computeJumpStartScore } from "../lib/scoring.ts";

test("computeJumpStartScore penalizes missing reach when followers exist", () => {
  const score = computeJumpStartScore({
    followers: 1_000,
    views: 5_000,
    reach: 0,
    engagements: 250,
    postsCount: 10,
    prevFollowers: 950,
    prevViews: 4_500,
    prevReach: 3_000,
    prevEngagements: 200,
    prevPostsCount: 8,
    periodDays: 30,
  });

  const reach = score.subScores.find((item) => item.key === "reach");

  assert.equal(reach?.value, 0);
  assert.ok(score.global < 80);
});

test("computeJumpStartScore uses restored reach in the global score", () => {
  const withoutReach = computeJumpStartScore({
    followers: 1_000,
    views: 5_000,
    reach: 0,
    engagements: 250,
    postsCount: 10,
    prevFollowers: 950,
    prevViews: 4_500,
    prevReach: 3_000,
    prevEngagements: 200,
    prevPostsCount: 8,
    periodDays: 30,
  });
  const withReach = computeJumpStartScore({
    followers: 1_000,
    views: 5_000,
    reach: 3_000,
    engagements: 250,
    postsCount: 10,
    prevFollowers: 950,
    prevViews: 4_500,
    prevReach: 2_500,
    prevEngagements: 200,
    prevPostsCount: 8,
    periodDays: 30,
  });

  assert.ok(withReach.global > withoutReach.global);
  assert.ok((withReach.subScores.find((item) => item.key === "reach")?.value ?? 0) > 0);
});
