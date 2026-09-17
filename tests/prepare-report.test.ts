import assert from "node:assert/strict";
import { test } from "node:test";
import { register } from "node:module";
register("./helpers/report-loader.mjs", import.meta.url);
const { prepareReport } = await import("../lib/prepare-report");

test("real report preparation does not turn an empty collection into a score or a decline", async () => {
  const totals = { followers: 0, views: 0, reach: 0, engagements: 0, posts_count: 0 };
  const data = {
    totals, prevTotals: { followers: 1000, views: 5000, reach: 3000, engagements: 500, posts_count: 5 },
    metrics: [], posts: [], perPlatform: [{ platform: "instagram", totals, prevTotals: totals, available: { views: true, reach: true, engagements: true }, delta: totals }], lastSync: null,
    range: { start: new Date(2026, 7, 1), end: new Date(2026, 7, 31) },
    prevRange: { start: new Date(2026, 6, 1), end: new Date(2026, 6, 31) },
  } as unknown as Parameters<typeof prepareReport>[0]["data"];
  const report = await prepareReport({ data, accounts: [], tenantName: "Test" });
  assert.equal(report.score, undefined);
  for (const label of ["Abonnés", "Vues", "Portée cumulée", "Interactions"]) {
    const metric = report.kpis.find(kpi => kpi.label === label)!;
    assert.equal(metric.value, null, label);
    assert.equal(metric.delta, null, label);
  }
  assert.equal(report.postsAnalyzed, 0);
  assert.equal(report.platforms[0].hasCurrentMetrics, false);
});
