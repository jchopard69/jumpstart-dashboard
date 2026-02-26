import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDemoSeedPayload } from "../lib/demo-seed";

const tenantId = "tenant-demo";
const accounts = {
  instagram: "acc-ig",
  facebook: "acc-fb",
  linkedin: "acc-li",
};
const now = new Date("2026-02-01T12:00:00.000Z");

function metricKey(row: { platform: string; social_account_id: string; date: string }) {
  return `${row.platform}:${row.social_account_id}:${row.date}`;
}

function postKey(row: { platform: string; social_account_id: string; external_post_id: string }) {
  return `${row.platform}:${row.social_account_id}:${row.external_post_id}`;
}

test("demo seed payload is deterministic and key-unique", () => {
  const first = buildDemoSeedPayload(tenantId, accounts, now);
  const second = buildDemoSeedPayload(tenantId, accounts, now);

  assert.equal(first.metrics.length, 90 * 3);
  assert.equal(first.posts.length, 16 + 12 + 10);

  const firstMetricKeys = first.metrics.map(metricKey);
  const secondMetricKeys = second.metrics.map(metricKey);
  assert.equal(new Set(firstMetricKeys).size, first.metrics.length);
  assert.deepEqual(firstMetricKeys, secondMetricKeys);

  const firstPostKeys = first.posts.map(postKey);
  const secondPostKeys = second.posts.map(postKey);
  assert.equal(new Set(firstPostKeys).size, first.posts.length);
  assert.deepEqual(firstPostKeys, secondPostKeys);
});

