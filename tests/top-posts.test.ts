import assert from "node:assert/strict";
import { test } from "node:test";

import { selectDisplayTopPosts } from "../lib/top-posts.ts";
import { getPostEngagements, getPostVisibility } from "../lib/metrics.ts";

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
  assert.equal(engagement[0], "balanced-performance");
  assert.notDeepEqual(performance, visibility);
  assert.notDeepEqual(visibility, engagement);
});

test("engagement ranking uses engagement volume before engagement rate", () => {
  const engagementPosts = [
    {
      id: "high-rate-small-volume",
      posted_at: "2026-05-10T10:00:00.000Z",
      metrics: { impressions: 100, engagements: 10 },
    },
    {
      id: "lower-rate-large-volume",
      posted_at: "2026-05-11T10:00:00.000Z",
      metrics: { impressions: 1_000, engagements: 100 },
    },
  ];

  const engagement = selectDisplayTopPosts(engagementPosts, engagementPosts.length, "engagement").map((post) => post.id);

  assert.deepEqual(engagement, ["lower-rate-large-volume", "high-rate-small-volume"]);
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

test("post metric helpers support native TikTok and Instagram API field names", () => {
  const tiktokMetrics = {
    view_count: 24_000,
    like_count: 1_800,
    comment_count: 95,
    share_count: 230,
  };
  const instagramMetrics = {
    impression_count: 8_500,
    comments_count: 42,
    like_count: 640,
    save_count: 88,
  };

  assert.deepEqual(getPostVisibility(tiktokMetrics, "video"), { label: "Vues", value: 24_000 });
  assert.equal(getPostEngagements(tiktokMetrics), 2_125);
  assert.deepEqual(getPostVisibility(instagramMetrics, "image"), { label: "Impressions", value: 8_500 });
  assert.equal(getPostEngagements(instagramMetrics), 770);
});

test("tabs rank by their own metric when connector fields are not pre-normalized", () => {
  const nativePosts = [
    {
      id: "viral-viewed",
      posted_at: "2026-05-10T10:00:00.000Z",
      media_type: "video",
      metrics: { view_count: 80_000, like_count: 500, comment_count: 30, share_count: 20 },
    },
    {
      id: "conversation-starter",
      posted_at: "2026-05-11T10:00:00.000Z",
      media_type: "image",
      metrics: { impression_count: 12_000, like_count: 1_100, comments_count: 180, save_count: 95 },
    },
  ];

  const visibility = selectDisplayTopPosts(nativePosts, nativePosts.length, "visibility").map((post) => post.id);
  const engagement = selectDisplayTopPosts(nativePosts, nativePosts.length, "engagement").map((post) => post.id);

  assert.deepEqual(visibility, ["viral-viewed", "conversation-starter"]);
  assert.deepEqual(engagement, ["conversation-starter", "viral-viewed"]);
});
