/**
 * Best Time to Post — analyzes post performance by day of week and hour
 * to identify optimal publishing windows.
 */

import { getPostEngagements } from "@/lib/metrics";

export type TimeSlot = {
  day: number; // 0 = Monday, 6 = Sunday
  hour: number; // 0-23
  avgEngagement: number;
  postCount: number;
  intensity: number; // 0-1 normalized
};

export type BestTimeData = {
  slots: TimeSlot[];
  bestDay: string;
  bestHour: string;
  totalPostsAnalyzed: number;
  platforms: string[];
};

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const HOUR_LABELS = [
  "6h-9h", "9h-12h", "12h-14h", "14h-17h", "17h-20h", "20h-23h"
];
const HOUR_RANGES: [number, number][] = [
  [6, 9], [9, 12], [12, 14], [14, 17], [17, 20], [20, 23]
];

export function analyzeBestTime(posts: Array<{
  posted_at?: string | null;
  metrics?: Record<string, unknown> | null;
  platform?: string | null;
}>): BestTimeData | null {
  const validPosts = posts.filter(p => p.posted_at);
  if (validPosts.length < 5) return null;

  // Aggregate engagement by day × hour slot
  const grid = new Map<string, { totalEng: number; count: number }>();

  for (const post of validPosts) {
    const date = new Date(post.posted_at!);
    // Convert JS day (0=Sun) to our format (0=Mon)
    const jsDay = date.getUTCDay();
    const day = jsDay === 0 ? 6 : jsDay - 1;
    const hour = date.getUTCHours();

    // Find which slot this hour belongs to
    const slotIndex = HOUR_RANGES.findIndex(([start, end]) => hour >= start && hour < end);
    if (slotIndex === -1) continue; // Outside 6h-23h

    const key = `${day}-${slotIndex}`;
    const eng = getPostEngagements(post.metrics);
    const existing = grid.get(key) ?? { totalEng: 0, count: 0 };
    existing.totalEng += eng;
    existing.count++;
    grid.set(key, existing);
  }

  if (grid.size < 3) return null;

  // Build all slots
  const slots: TimeSlot[] = [];
  let maxAvg = 0;

  for (let day = 0; day < 7; day++) {
    for (let hourSlot = 0; hourSlot < HOUR_RANGES.length; hourSlot++) {
      const key = `${day}-${hourSlot}`;
      const data = grid.get(key);
      const avgEngagement = data ? data.totalEng / data.count : 0;
      const postCount = data?.count ?? 0;

      if (avgEngagement > maxAvg) maxAvg = avgEngagement;

      slots.push({
        day,
        hour: hourSlot,
        avgEngagement,
        postCount,
        intensity: 0, // will normalize below
      });
    }
  }

  // Normalize intensities
  for (const slot of slots) {
    slot.intensity = maxAvg > 0 ? slot.avgEngagement / maxAvg : 0;
  }

  // Find best day and hour
  const bestSlot = slots.reduce((a, b) => a.avgEngagement > b.avgEngagement ? a : b);
  const bestDay = DAY_LABELS[bestSlot.day];
  const bestHour = HOUR_LABELS[bestSlot.hour];

  const platforms = Array.from(new Set(validPosts.map(p => p.platform).filter(Boolean) as string[]));

  return {
    slots,
    bestDay,
    bestHour,
    totalPostsAnalyzed: validPosts.length,
    platforms,
  };
}

export { DAY_LABELS, HOUR_LABELS };
