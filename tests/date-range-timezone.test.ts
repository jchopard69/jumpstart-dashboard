import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveDateRange, toIsoDate } from "../lib/date";

test("custom date range preserves calendar bounds in Europe/Paris", () => {
  const previousTz = process.env.TZ;
  process.env.TZ = "Europe/Paris";

  try {
    const range = resolveDateRange("custom", "2026-03-01", "2026-03-31");

    assert.equal(toIsoDate(range.start), "2026-03-01");
    assert.equal(toIsoDate(range.end), "2026-03-31");
  } finally {
    if (previousTz === undefined) delete process.env.TZ;
    else process.env.TZ = previousTz;
  }
});
