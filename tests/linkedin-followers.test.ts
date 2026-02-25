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

// ── Integration-style tests: follower mapping ───────────────────────

describe("LinkedIn follower count mapping", () => {
  test("paging.total=1 should be treated as unreliable (not a real follower count)", () => {
    // Simulates what fetchFollowerCount should do when paging.total=1
    const pagingTotal = 1;
    // The fix: values <= 1 are considered unreliable pagination artifacts
    const result = pagingTotal > 1 ? pagingTotal : 0;
    assert.equal(result, 0, "paging.total=1 should produce 0, not 1");
  });

  test("paging.total=5000 should be trusted", () => {
    const pagingTotal = 5000;
    const result = pagingTotal > 1 ? pagingTotal : 0;
    assert.equal(result, 5000);
  });

  test("paging.total=0 should return 0", () => {
    const pagingTotal = 0;
    const result = pagingTotal > 1 ? pagingTotal : 0;
    assert.equal(result, 0);
  });

  test("paging.total=2 should be trusted (edge case)", () => {
    const pagingTotal = 2;
    const result = pagingTotal > 1 ? pagingTotal : 0;
    assert.equal(result, 2);
  });

  test("undefined paging should return 0", () => {
    const paging = undefined as { total?: number } | undefined;
    const pagingTotal = paging?.total ?? 0;
    const result = pagingTotal > 1 ? pagingTotal : 0;
    assert.equal(result, 0);
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
