import assert from "node:assert/strict";
import { test } from "node:test";
import { buildProductionReadiness } from "../lib/production-readiness";

test("buildProductionReadiness summarizes production continuity", () => {
  const readiness = buildProductionReadiness({
    shootDaysRemaining: 4,
    shoots: [{ shoot_date: "2099-02-15", location: "Paris Studio" }],
    documents: [
      { file_name: "Brief contenu", tag: "brief" },
      { file_name: "Moodboard", tag: "creative" },
    ],
  });

  assert.equal(readiness.status, "ready");
  assert.equal(readiness.statusLabel, "Production cadrée");
  assert.equal(readiness.documentCount, 2);
  assert.equal(readiness.nextShootLocation, "Paris Studio");
});

test("buildProductionReadiness accepts French formatted PDF dates", () => {
  const readiness = buildProductionReadiness({
    shootDaysRemaining: 1,
    shoots: [{ shoot_date: "15/02/2099", location: "Lyon" }],
    documents: [],
  });

  assert.notEqual(readiness.nextShootLabel, "Date à confirmer");
});
