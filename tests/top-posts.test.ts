import assert from "node:assert/strict";
import { test } from "node:test";

import { selectDisplayTopPosts } from "../lib/top-posts.ts";

const posts = [
  {
    id: "high-visibility",
    posted_at: "2026-05-10T10:00:00.000Z",
    media_type: "image",
    metrics: { impressions: 10_000, engagements: 100 },
  },
  {
    id: "high-engagement-rate",
    posted_at: "2026-05-11T10:00:00.000Z",
    media_type: "image",
    metrics: { impressions: 1_000, engagements: 200 },
  },
  {
    id: "balanced-performance",
    posted_at: "2026-05-12T10:00:00.000Z",
    media_type: "image",
    metrics: { impressions: 6_000, engagements: 500 },
  },
];

test("top posts use distinct rankings for performance, visibility, and engagement", () => {
  const performance = selectDisplayTopPosts(posts, posts.length, "performance").map((post) => post.id);
  const visibility = selectDisplayTopPosts(posts, posts.length, "visibility").map((post) => post.id);
  const engagement = selectDisplayTopPosts(posts, posts.length, "engagement").map((post) => post.id);

  assert.equal(performance[0], "balanced-performance");
  assert.equal(visibility[0], "high-visibility");
  assert.equal(engagement[0], "high-engagement-rate");
});

test("engagement ranking falls back to engagement volume when rates are tied", () => {
  const tiedRatePosts = [
    {
      id: "small",
      posted_at: "2026-05-10T10:00:00.000Z",
      metrics: { impressions: 100, engagements: 10 },
    },
    {
      id: "large",
      posted_at: "2026-05-11T10:00:00.000Z",
      metrics: { impressions: 1_000, engagements: 100 },
    },
  ];

  const engagement = selectDisplayTopPosts(tiedRatePosts, tiedRatePosts.length, "engagement").map((post) => post.id);

  assert.deepEqual(engagement, ["large", "small"]);
});

test("visibility ranking excludes posts that only have engagement when visibility data exists", () => {
  const mixedPosts = [
    {
      id: "engagement-only",
      posted_at: "2026-05-10T10:00:00.000Z",
      metrics: { engagements: 500 },
    },
    {
      id: "visible",
      posted_at: "2026-05-11T10:00:00.000Z",
      metrics: { impressions: 1_000, engagements: 10 },
    },
  ];

  const visibility = selectDisplayTopPosts(mixedPosts, mixedPosts.length, "visibility").map((post) => post.id);

  assert.deepEqual(visibility, ["visible"]);
});

test("engagement ranking excludes posts that only have visibility when engagement data exists", () => {
  const mixedPosts = [
    {
      id: "visibility-only",
      posted_at: "2026-05-10T10:00:00.000Z",
      metrics: { impressions: 5_000 },
    },
    {
      id: "engaged",
      posted_at: "2026-05-11T10:00:00.000Z",
      metrics: { impressions: 500, engagements: 50 },
    },
  ];

  const engagement = selectDisplayTopPosts(mixedPosts, mixedPosts.length, "engagement").map((post) => post.id);

  assert.deepEqual(engagement, ["engaged"]);
});
