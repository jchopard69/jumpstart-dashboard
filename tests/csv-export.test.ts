import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMetricCsvRows, toCsv } from "../lib/csv-export.ts";

test("buildMetricCsvRows keeps existing metric columns and appends export context", () => {
  const rows = buildMetricCsvRows({
    expectedDays: 2,
    accounts: [{ id: "account-1", account_name: "JumpStart Instagram" }],
    lastSync: { status: "success", finished_at: "2026-06-03T08:00:00Z" },
    rows: [
      {
        date: "2026-06-02",
        platform: "instagram",
        social_account_id: "account-1",
        followers: 100,
        impressions: 900,
        reach: 700,
        engagements: 45,
        views: 800,
        watch_time: 120,
        posts_count: 1,
      },
    ],
  });

  assert.deepEqual(Object.keys(rows[0]), [
    "Date",
    "Plateforme",
    "Abonnés",
    "Impressions",
    "Portée",
    "Engagements",
    "Vues",
    "Temps de visionnage (min)",
    "Publications",
    "Compte",
    "Couverture période (%)",
    "Dernière synchronisation",
  ]);
  assert.equal(rows[0].Compte, "JumpStart Instagram");
  assert.equal(rows[0]["Temps de visionnage (min)"], 2);
  assert.equal(rows[0]["Couverture période (%)"], 50);
});

test("toCsv escapes commas and quotes", () => {
  const csv = toCsv([{ Name: 'Client, "Premium"', Value: 12 }]);
  assert.equal(csv, 'Name,Value\n"Client, ""Premium""",12');
});

