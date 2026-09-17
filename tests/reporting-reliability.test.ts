import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPreviousRange, countCalendarDays, resolveDateRange, toIsoDate } from "../lib/date";
import { readAllRows } from "../lib/paginated-read";
import { buildDailySeries } from "../lib/daily-series";
import { computeDashboardDataQuality } from "../lib/dashboard-data-quality";

for (const [from, to, count] of [["2026-03-29", "2026-03-29", 1], ["2026-03-25", "2026-03-31", 7], ["2026-03-02", "2026-03-31", 30], ["2026-10-02", "2026-11-01", 31]] as const) {
  test(`comparison preserves ${count} calendar days across DST: ${from}`, () => {
    const priorTz = process.env.TZ;
    process.env.TZ = "Europe/Paris";
    try {
      const range = resolveDateRange("custom", from, to);
      const previous = buildPreviousRange(range);
      assert.equal(countCalendarDays(range), count);
      assert.equal(countCalendarDays(previous), count);
      assert.ok(previous.end < range.start);
      assert.notEqual(toIsoDate(previous.end), toIsoDate(range.start));
    } finally {
      if (priorTz === undefined) delete process.env.TZ; else process.env.TZ = priorTz;
    }
  });
}

test("pagination reads all rows despite a smaller service cap", async () => {
  const source = Array.from({ length: 1201 }, (_, id) => ({ id }));
  const rows = await readAllRows(async (from, to) => ({ data: source.slice(from, Math.min(to + 1, from + 200)), count: source.length, error: null }), "fixture");
  assert.deepEqual(rows, source);
});
test("pagination fails closed on failed, truncated or changing reads", async () => {
  await assert.rejects(readAllRows(async () => ({ data: null, count: null, error: { message: "failed" } }), "fixture"));
  await assert.rejects(readAllRows(async () => ({ data: [], count: 2, error: null }), "fixture"), /incomplète/);
  let call = 0;
  await assert.rejects(readAllRows(async () => ({ data: [{ id: call++ }], count: call === 1 ? 2 : 3, error: null }), "fixture"), /changé/);
});
test("pagination accepts a genuinely empty range", async () => {
  assert.deepEqual(await readAllRows(async () => ({ data: [], count: 0, error: null }), "fixture"), []);
});
test("sparklines aggregate accounts by day and carry observed follower stocks", () => {
  const metrics = [
    { date: "2026-05-02", social_account_id: "a", followers: 110, views: 20, reach: 10, engagements: 2 },
    { date: "2026-05-01", social_account_id: "b", followers: 200, views: 50, reach: 30, engagements: 5 },
    { date: "2026-05-01", social_account_id: "a", followers: 100, views: 10, reach: 5, engagements: 1 },
  ];
  assert.deepEqual(buildDailySeries(metrics, "views"), [60, 20]);
  assert.deepEqual(buildDailySeries(metrics, "followers"), [300, 310]);
});
test("one populated account cannot hide a missing second account", () => {
  const quality = computeDashboardDataQuality({
    range: resolveDateRange("custom", "2026-05-01", "2026-05-02"),
    accounts: [{ id: "a", platform: "instagram" }, { id: "b", platform: "instagram" }],
    metrics: [
      { date: "2026-05-01", social_account_id: "a", platform: "instagram", followers: 100 },
      { date: "2026-05-02", social_account_id: "a", platform: "instagram", followers: 110 },
      { date: "2026-05-03", social_account_id: "b", platform: "instagram", followers: 100 },
    ],
    perPlatform: [], lastSync: { status: "failed", finished_at: new Date().toISOString() },
  });
  assert.equal(quality.overallCoverage, 50);
  assert.equal(quality.expectedDays, 2);
  assert.equal(quality.platformQuality[0].expectedAccountDays, 4);
  assert.equal(quality.staleSync, true);
});

test("monthly reporting covers the completed calendar month, including leap years", async () => {
  const { getScheduledReportPeriod } = await import("../lib/report-period");
  assert.deepEqual(getScheduledReportPeriod("monthly", new Date(2024, 2, 1, 12)), { from: "2024-02-01", to: "2024-02-29" });
  assert.deepEqual(getScheduledReportPeriod("weekly", new Date(2026, 8, 7, 12)), { from: "2026-08-31", to: "2026-09-06" });
});

test("a full calendar month compares with the entire previous month",()=>{ for(const [from,to,prevFrom,prevTo] of [["2026-03-01","2026-03-31","2026-02-01","2026-02-28"],["2024-03-01","2024-03-31","2024-02-01","2024-02-29"],["2026-01-01","2026-01-31","2025-12-01","2025-12-31"]]){const prior=buildPreviousRange(resolveDateRange("custom",from,to));assert.equal(toIsoDate(prior.start),prevFrom);assert.equal(toIsoDate(prior.end),prevTo);}});
