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
    "Taux d'engagement (%)",
    "Compte",
    "Couverture période (%)",
    "Statut donnée",
    "Recommandation automatique",
    "Priorité V2",
    "Brief automatisable",
    "Dernière synchronisation",
  ]);
  assert.equal(rows[0].Compte, "JumpStart Instagram");
  assert.equal(rows[0]["Temps de visionnage (min)"], 2);
  assert.equal(rows[0]["Couverture période (%)"], 50);
  assert.equal(rows[0]["Taux d'engagement (%)"], 5.6);
  assert.equal(rows[0]["Statut donnée"], "Couverture partielle");
  assert.equal(rows[0]["Recommandation automatique"], "Capitaliser sur ce créneau ou format");
  assert.equal(rows[0]["Priorité V2"], "Brief à produire");
  assert.match(String(rows[0]["Brief automatisable"]), /hook, preuve, CTA/);
});

test("buildMetricCsvRows flags rows that need data repair", () => {
  const rows = buildMetricCsvRows({
    expectedDays: 4,
    accounts: [],
    lastSync: { status: "failed", finished_at: null },
    rows: [
      {
        date: "2026-06-02",
        platform: "tiktok",
        reach: 0,
        views: 0,
        impressions: 0,
        engagements: 20,
        posts_count: 1,
      },
    ],
  });

  assert.equal(rows[0]["Couverture période (%)"], 25);
  assert.equal(rows[0]["Statut donnée"], "Données à fiabiliser");
  assert.equal(rows[0]["Recommandation automatique"], "Vérifier la synchronisation avant analyse");
  assert.equal(rows[0]["Priorité V2"], "Fiabilisation data");
  assert.match(String(rows[0]["Brief automatisable"]), /synchronisation tiktok/);
});

test("toCsv escapes commas and quotes", () => {
  const csv = toCsv([{ Name: 'Client, "Premium"', Value: 12 }]);
  assert.equal(csv, 'Name,Value\n"Client, ""Premium""",12');
});
