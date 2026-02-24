/**
 * Best Time to Post — analyzes post performance by day of week and hour
 * to identify optimal publishing windows based on visibility (views/reach).
 */

import { getPostVisibility } from "@/lib/metrics";

export type TimeSlot = {
  day: number; // 0 = Monday, 6 = Sunday
  hour: number; // 0-5 (index into HOUR_LABELS)
  avgVisibility: number;
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

export function analyzeBestTime(
  posts: Array<{
    posted_at?: string | null;
    metrics?: Record<string, unknown> | null;
    media_type?: string | null;
    platform?: string | null;
  }>,
  platformFilter?: string
): BestTimeData | null {
  // Filter by platform if specified
  const filtered = platformFilter && platformFilter !== "all"
    ? posts.filter(p => p.platform === platformFilter)
    : posts;

  const validPosts = filtered.filter(p => p.posted_at);
  if (validPosts.length < 5) return null;

  // Aggregate visibility (views/reach/impressions) by day × hour slot
  const grid = new Map<string, { totalVis: number; count: number }>();

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
    const visibility = getPostVisibility(post.metrics, post.media_type).value;
    const existing = grid.get(key) ?? { totalVis: 0, count: 0 };
    existing.totalVis += visibility;
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
      const avgVisibility = data ? data.totalVis / data.count : 0;
      const postCount = data?.count ?? 0;

      if (avgVisibility > maxAvg) maxAvg = avgVisibility;

      slots.push({
        day,
        hour: hourSlot,
        avgVisibility,
        postCount,
        intensity: 0, // will normalize below
      });
    }
  }

  // Normalize intensities
  for (const slot of slots) {
    slot.intensity = maxAvg > 0 ? slot.avgVisibility / maxAvg : 0;
  }

  // Find best day and hour
  const bestSlot = slots.reduce((a, b) => a.avgVisibility > b.avgVisibility ? a : b);
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
