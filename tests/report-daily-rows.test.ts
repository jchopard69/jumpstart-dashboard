import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReportDailyRows } from "../lib/report-daily-rows";
import type { DashboardMetric } from "../lib/types/dashboard";
const row = (overrides: Partial<DashboardMetric> = {}): DashboardMetric => ({ date: "2026-08-01", platform: "instagram", social_account_id: "a", followers: null, views: null, reach: null, engagements: null, ...overrides });
test("daily report distinguishes a missing measurement from a measured zero", () => {
  const result = buildReportDailyRows([row(), row({ date: "2026-08-02", followers: 0, views: 0 })], "instagram");
  assert.equal(result[0].followers, null);
  assert.equal(result[0].views, null);
  assert.equal(result[1].followers, 0);
  assert.equal(result[1].views, 0);
});
test("daily report sums observed accounts, without carrying an absent account forward", () => {
  const result = buildReportDailyRows([row({ followers: 100, views: 10 }), row({ social_account_id: "b", followers: 200, views: 20 }), row({ date: "2026-08-02", followers: 110 })], "instagram");
  assert.equal(result[0].followers, 300);
  assert.equal(result[0].views, 30);
  assert.equal(result[1].followers, 110);
});
test("daily report respects unavailable metrics and suppresses TikTok reach proxies", () => {
  assert.equal(buildReportDailyRows([row({ views: 99 })], "instagram", { views: false, reach: true, engagements: true })[0].views, null);
  assert.equal(buildReportDailyRows([row({ platform: "tiktok", reach: 99 })], "tiktok")[0].reach, null);
});
