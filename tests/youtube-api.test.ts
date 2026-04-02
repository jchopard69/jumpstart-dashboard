import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { youtubeConnector } from "../lib/social-platforms/youtube/api";
import { getDashboardMetricAvailability } from "../lib/dashboard-metric-availability";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("YouTube dashboard availability", () => {
  test("youtube does not expose reach by default when no real reach metric exists", () => {
    assert.deepEqual(
      getDashboardMetricAvailability(
        "youtube",
        { views: 0, reach: 0, engagements: 0 },
        { views: 0, reach: 0, engagements: 0 }
      ),
      {
        views: true,
        reach: false,
        engagements: true,
      }
    );
  });
});

describe("YouTube connector analytics sync", () => {
  test("uses Analytics API period views instead of lifetime channel totals", async () => {
    const previousClientId = process.env.GOOGLE_CLIENT_ID;
    const previousClientSecret = process.env.GOOGLE_CLIENT_SECRET;

    process.env.GOOGLE_CLIENT_ID = "google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";

    const originalFetch = global.fetch;
    const now = new Date();
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    const yesterday = new Date(today.getTime() - DAY_MS);
    const todayKey = today.toISOString().slice(0, 10);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);

    global.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));

      if (url.hostname === "www.googleapis.com" && url.pathname === "/youtube/v3/channels") {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "UC123",
                snippet: {
                  title: "Audit Channel",
                  description: "A test channel",
                  thumbnails: {
                    medium: { url: "https://img.example.com/channel.jpg" },
                  },
                },
                statistics: {
                  subscriberCount: "58000",
                  viewCount: "26200000",
                  videoCount: "420",
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (
        url.hostname === "youtubeanalytics.googleapis.com" &&
        url.pathname === "/v2/reports" &&
        url.searchParams.get("dimensions") === "day"
      ) {
        assert.equal(url.searchParams.get("ids"), "channel==UC123");
        return new Response(
          JSON.stringify({
            columnHeaders: [
              { name: "day" },
              { name: "views" },
              { name: "likes" },
              { name: "comments" },
              { name: "shares" },
              { name: "subscribersGained" },
              { name: "subscribersLost" },
              { name: "estimatedMinutesWatched" },
            ],
            rows: [
              [yesterdayKey, 1200, 20, 5, 2, 15, 4, 450],
              [todayKey, 800, 12, 4, 1, 11, 3, 300],
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.hostname === "www.googleapis.com" && url.pathname === "/youtube/v3/search") {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: { videoId: "vid-1" },
                snippet: { publishedAt: `${yesterdayKey}T10:00:00.000Z` },
              },
              {
                id: { videoId: "vid-2" },
                snippet: { publishedAt: `${todayKey}T12:00:00.000Z` },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.hostname === "www.googleapis.com" && url.pathname === "/youtube/v3/videos") {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "vid-1",
                snippet: {
                  title: "Video 1",
                  description: "Video 1",
                  publishedAt: `${yesterdayKey}T10:00:00.000Z`,
                  thumbnails: { medium: { url: "https://img.example.com/vid-1.jpg" } },
                },
                statistics: {
                  viewCount: "9000000",
                  likeCount: "900",
                  commentCount: "90",
                },
              },
              {
                id: "vid-2",
                snippet: {
                  title: "Video 2",
                  description: "Video 2",
                  publishedAt: `${todayKey}T12:00:00.000Z`,
                  thumbnails: { medium: { url: "https://img.example.com/vid-2.jpg" } },
                },
                statistics: {
                  viewCount: "17000000",
                  likeCount: "1700",
                  commentCount: "170",
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (
        url.hostname === "youtubeanalytics.googleapis.com" &&
        url.pathname === "/v2/reports" &&
        url.searchParams.get("dimensions") === "video"
      ) {
        return new Response(
          JSON.stringify({
            columnHeaders: [
              { name: "video" },
              { name: "views" },
              { name: "likes" },
              { name: "comments" },
              { name: "shares" },
              { name: "estimatedMinutesWatched" },
            ],
            rows: [
              ["vid-1", 700, 7, 2, 1, 120],
              ["vid-2", 400, 4, 1, 0, 80],
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Unexpected fetch: ${url.toString()}`);
    }) as typeof fetch;

    try {
      const result = await youtubeConnector.sync({
        tenantId: "tenant-1",
        socialAccountId: "social-1",
        externalAccountId: "UC123",
        accessToken: "youtube-access-token",
      });

      const viewsSum = result.dailyMetrics.reduce((sum, metric) => sum + (metric.views ?? 0), 0);
      assert.equal(viewsSum, 2000);

      const todayMetric = result.dailyMetrics.find((metric) => metric.date === todayKey);
      const yesterdayMetric = result.dailyMetrics.find((metric) => metric.date === yesterdayKey);

      assert.equal(todayMetric?.followers, 58000);
      assert.equal(yesterdayMetric?.followers, 57992);
      assert.equal(todayMetric?.engagements, 17);
      assert.equal(yesterdayMetric?.engagements, 27);

      assert.equal(result.posts.length, 2);
      const postsById = new Map(result.posts.map((post) => [post.external_post_id, post]));
      assert.equal(postsById.get("vid-1")?.metrics?.views, 700);
      assert.equal(postsById.get("vid-1")?.metrics?.engagements, 10);
      assert.equal(postsById.get("vid-2")?.metrics?.views, 400);
      assert.equal(postsById.get("vid-2")?.metrics?.engagements, 5);
    } finally {
      global.fetch = originalFetch;
      if (previousClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
      else process.env.GOOGLE_CLIENT_ID = previousClientId;
      if (previousClientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
      else process.env.GOOGLE_CLIENT_SECRET = previousClientSecret;
    }
  });
});
