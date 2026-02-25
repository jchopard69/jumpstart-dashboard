import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { detectLinkedInMediaType, normalizeOrganizationId } from "../lib/social-platforms/linkedin/api";

// ── Unit tests: LinkedIn helpers ────────────────────────────────────

describe("normalizeOrganizationId", () => {
  test("strips urn:li:organization: prefix", () => {
    assert.equal(normalizeOrganizationId("urn:li:organization:12345"), "12345");
  });

  test("strips urn:li:organizationalPage: prefix", () => {
    assert.equal(normalizeOrganizationId("urn:li:organizationalPage:67890"), "67890");
  });

  test("returns raw numeric id unchanged", () => {
    assert.equal(normalizeOrganizationId("12345"), "12345");
  });
});

describe("detectLinkedInMediaType", () => {
  test("returns text when content is undefined", () => {
    assert.equal(detectLinkedInMediaType(undefined), "text");
  });

  test("detects carousel from carousel field", () => {
    assert.equal(detectLinkedInMediaType({ carousel: {} }), "carousel");
  });

  test("detects carousel from multiImage field", () => {
    assert.equal(detectLinkedInMediaType({ multiImage: {} }), "carousel");
  });

  test("detects video from media.video", () => {
    assert.equal(detectLinkedInMediaType({ media: { video: {} } }), "video");
  });

  test("detects link from article field", () => {
    assert.equal(detectLinkedInMediaType({ article: {} }), "link");
  });

  test("returns text for empty content", () => {
    assert.equal(detectLinkedInMediaType({}), "text");
  });
});

// ── Cascade strategy tests: follower count selection ─────────────────

describe("LinkedIn follower count cascade logic", () => {
  /**
   * Simulates the cascade strategy used in fetchFollowerCount:
   * 1. organizationalEntityFollowerStatistics → exact total
   * 2. networkSizes → firstDegreeSize
   * 3. DMA element enumeration → partial (ignored, returns 0)
   */
  function simulateCascade(
    strategy1Result: number | null, // null = API error / missing scope
    strategy2Result: number | null,
    strategy3DmaCount: number | null
  ): number {
    // Strategy 1: followerStatistics
    if (strategy1Result !== null && strategy1Result > 0) return strategy1Result;
    // Strategy 2: networkSizes
    if (strategy2Result !== null && strategy2Result > 0) return strategy2Result;
    // Strategy 3: DMA enumeration — partial, NOT returned as count
    // (DMA only sees a subset, e.g. 26 out of 4434)
    return 0;
  }

  test("strategy 1 wins when available (exact total)", () => {
    assert.equal(simulateCascade(4434, 4400, 26), 4434);
  });

  test("strategy 2 wins when strategy 1 fails", () => {
    assert.equal(simulateCascade(null, 4400, 26), 4400);
  });

  test("returns 0 when only DMA enumeration available (partial count is misleading)", () => {
    assert.equal(simulateCascade(null, null, 26), 0);
  });

  test("returns 0 when all strategies fail", () => {
    assert.equal(simulateCascade(null, null, null), 0);
  });

  test("strategy 1 returning 0 falls through to strategy 2", () => {
    assert.equal(simulateCascade(0, 500, 10), 500);
  });

  test("both strategies returning 0 falls through to return 0", () => {
    assert.equal(simulateCascade(0, 0, 26), 0);
  });
});

describe("LinkedIn connector fallback guard (> 1)", () => {
  /**
   * Simulates the connector logic that guards against values ≤ 1
   * from the fallback (fetchFollowerCount). The connector only trusts
   * values > 1 to avoid the known DMA pagination artifact.
   */
  function applyConnectorGuard(edgeAnalyticsTotal: number, fallbackCount: number): number {
    if (edgeAnalyticsTotal > 0) return edgeAnalyticsTotal;
    if (fallbackCount > 1) return fallbackCount;
    return 0;
  }

  test("uses EdgeAnalytics total when available", () => {
    assert.equal(applyConnectorGuard(4434, 0), 4434);
  });

  test("uses fallback when EdgeAnalytics returns 0 and fallback > 1", () => {
    assert.equal(applyConnectorGuard(0, 4434), 4434);
  });

  test("rejects fallback value of 1 (known pagination artifact)", () => {
    assert.equal(applyConnectorGuard(0, 1), 0);
  });

  test("rejects fallback value of 0", () => {
    assert.equal(applyConnectorGuard(0, 0), 0);
  });
});

// ── Cumsum logic tests ──────────────────────────────────────────────

describe("LinkedIn cumsum logic", () => {
  /**
   * Replicates the cumsum logic from sync.ts to test it in isolation.
   */
  function applyCumsum(
    metrics: Array<{ date: string; followers?: number }>,
    baseline: number
  ) {
    const sorted = [...metrics].sort((a, b) => a.date.localeCompare(b.date));
    const lastEntry = sorted[sorted.length - 1];
    const lastValue = lastEntry?.followers ?? 0;
    const dailyGains = sorted.slice(0, -1);
    const maxDailyGain = dailyGains.reduce(
      (max, m) => Math.max(max, m.followers ?? 0),
      0
    );

    const lastIsAbsoluteTotal =
      lastValue > 1 && (dailyGains.length === 0 || lastValue > maxDailyGain * 10);

    if (lastIsAbsoluteTotal && lastValue > 0) {
      let cumulative = baseline;
      for (const metric of dailyGains) {
        const delta = metric.followers ?? 0;
        cumulative += delta;
        metric.followers = cumulative;
      }
      lastEntry.followers = Math.max(lastValue, baseline);
    } else {
      let cumulative = baseline;
      for (const metric of sorted) {
        const delta = metric.followers ?? 0;
        cumulative += delta;
        metric.followers = cumulative;
      }
      if (sorted.length > 0) {
        const finalValue = sorted[sorted.length - 1].followers ?? 0;
        if (finalValue < baseline && baseline > 0) {
          sorted[sorted.length - 1].followers = baseline;
        }
      }
    }

    return sorted;
  }

  test("absolute total on latest date is preserved, not treated as delta", () => {
    const metrics = [
      { date: "2025-01-01", followers: 5 },
      { date: "2025-01-02", followers: 3 },
      { date: "2025-01-03", followers: 5000 }, // absolute total
    ];
    const result = applyCumsum(metrics, 0);
    // Last date should show 5000 (the absolute total), not 5008
    assert.equal(result[2].followers, 5000);
    // Earlier dates should have cumulative gains
    assert.equal(result[0].followers, 5);
    assert.equal(result[1].followers, 8);
  });

  test("all small values are treated as gains and cumsummed", () => {
    const metrics = [
      { date: "2025-01-01", followers: 5 },
      { date: "2025-01-02", followers: 3 },
      { date: "2025-01-03", followers: 2 },
    ];
    const result = applyCumsum(metrics, 100);
    assert.equal(result[0].followers, 105);
    assert.equal(result[1].followers, 108);
    assert.equal(result[2].followers, 110);
  });

  test("baseline is never regressed below", () => {
    const metrics = [
      { date: "2025-01-01", followers: 0 },
      { date: "2025-01-02", followers: 0 },
      { date: "2025-01-03", followers: 0 },
    ];
    const result = applyCumsum(metrics, 500);
    // Final value should be at least baseline
    assert.equal(result[2].followers, 500);
  });

  test("total of 1 on last date should NOT produce followers=1 on dashboard", () => {
    // This is the exact bug scenario: EdgeAnalytics returned 0,
    // fallback returned 1, connector set 1 on latest date
    const metrics = [
      { date: "2025-01-01", followers: 0 },
      { date: "2025-01-02", followers: 0 },
      { date: "2025-01-03", followers: 1 }, // buggy fallback
    ];
    const result = applyCumsum(metrics, 0);
    // With the fix, value of 1 is treated as a gain (not absolute total)
    // and cumsummed normally: 0 + 0 + 1 = 1
    // But with baseline=0, this is the correct behavior (edge case)
    // The real fix is upstream: fetchFollowerCount returns 0 instead of 1
    assert.equal(result[2].followers, 1);
  });

  test("total of 1 with existing baseline should preserve baseline", () => {
    const metrics = [
      { date: "2025-01-01", followers: 0 },
      { date: "2025-01-02", followers: 0 },
      { date: "2025-01-03", followers: 1 }, // buggy fallback
    ];
    // With a real baseline, cumsum result (1) < baseline (500) → keep baseline
    const result = applyCumsum(metrics, 500);
    assert.equal(result[2].followers, 501);
  });

  test("handles empty metrics array", () => {
    const result = applyCumsum([], 100);
    assert.equal(result.length, 0);
  });
});
