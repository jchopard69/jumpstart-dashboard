import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeDashboardFilters } from "../lib/dashboard-filters";
import { resolveDateRange } from "../lib/date";

process.env.TZ = "UTC";

test("normalizeDashboardFilters handles all platforms and accounts", () => {
  assert.deepEqual(
    normalizeDashboardFilters({ platform: "all", socialAccountId: "all" }),
    { platform: null, socialAccountId: null }
  );

  assert.deepEqual(
    normalizeDashboardFilters({ platform: "instagram", socialAccountId: "abc123" }),
    { platform: "instagram", socialAccountId: "abc123" }
  );
});

test("resolveDateRange last_30_days is inclusive", () => {
  const now = new Date("2025-01-30T12:00:00.000Z");
  const range = resolveDateRange("last_30_days", undefined, undefined, now);

  assert.equal(range.start.toISOString().slice(0, 10), "2025-01-01");
  assert.equal(range.end.toISOString().slice(0, 10), "2025-01-30");
});
