import { addDays, subDays } from "date-fns";
import type { Connector, ConnectorSyncResult } from "./types";
import type { Platform } from "@/lib/types";

const platforms: Platform[] = ["instagram", "facebook", "linkedin", "tiktok", "youtube"];

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildDailyMetrics(): ConnectorSyncResult["dailyMetrics"] {
  const start = subDays(new Date(), 30);
  const metrics: ConnectorSyncResult["dailyMetrics"] = [];
  let followers = randomBetween(1200, 8000);

  for (let i = 0; i < 31; i += 1) {
    const date = addDays(start, i);
    const growth = randomBetween(-5, 40);
    followers = Math.max(0, followers + growth);
    metrics.push({
      date: date.toISOString().slice(0, 10),
      followers,
      impressions: randomBetween(500, 9000),
      reach: randomBetween(400, 7000),
      engagements: randomBetween(50, 900),
      likes: randomBetween(20, 600),
      comments: randomBetween(2, 120),
      shares: randomBetween(1, 80),
      saves: randomBetween(1, 50),
      views: randomBetween(100, 10000),
      watch_time: randomBetween(200, 5000),
      posts_count: randomBetween(0, 4)
    });
  }

  return metrics;
}

function buildPosts(): ConnectorSyncResult["posts"] {
  return new Array(8).fill(null).map((_, index) => ({
    external_post_id: `mock-post-${index + 1}`,
    posted_at: subDays(new Date(), randomBetween(1, 30)).toISOString(),
    url: "https://example.com",
    caption: "Campaign highlight: driving real results for JumpStart Studio clients.",
    media_type: "image",
    thumbnail_url: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=400&q=80",
    media_url: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=800&q=80",
    metrics: {
      impressions: randomBetween(400, 9000),
      reach: randomBetween(300, 7000),
      engagements: randomBetween(30, 900),
      likes: randomBetween(20, 500),
      comments: randomBetween(2, 120),
      shares: randomBetween(1, 80),
      saves: randomBetween(1, 50),
      views: randomBetween(100, 6000)
    }
  }));
}

export const mockConnector: Connector = {
  platform: "instagram",
  async sync() {
    return {
      dailyMetrics: buildDailyMetrics(),
      posts: buildPosts()
    };
  }
};

export function getMockConnectors() {
  return platforms.map((platform) => ({
    platform,
    async sync() {
      return {
        dailyMetrics: buildDailyMetrics(),
        posts: buildPosts()
      };
    }
  }));
}
