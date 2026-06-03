import assert from "node:assert/strict";
import { test } from "node:test";

import { computeAdminClientHealth } from "../lib/admin-client-health.ts";

const now = new Date("2026-06-03T12:00:00Z");

test("admin client health marks active synced clients as healthy", () => {
  const health = computeAdminClientHealth({
    isActive: true,
    platforms: ["instagram", "linkedin"],
    lastSyncStatus: "success",
    lastSyncAt: "2026-06-03T08:00:00Z",
    now,
  });

  assert.equal(health.status, "healthy");
  assert.equal(health.score, 100);
  assert.equal(health.nextAction, "Préparer la prochaine décision client à partir du dashboard.");
});

test("admin client health prioritizes failed syncs", () => {
  const health = computeAdminClientHealth({
    isActive: true,
    platforms: ["tiktok"],
    lastSyncStatus: "failed",
    lastSyncAt: "2026-06-02T08:00:00Z",
    now,
  });

  assert.equal(health.status, "watch");
  assert.match(health.summary, /dernière sync en erreur/);
  assert.equal(health.nextAction, "Ouvrir le client et corriger la synchronisation.");
});

test("admin client health flags clients without connected platforms", () => {
  const health = computeAdminClientHealth({
    isActive: true,
    platforms: [],
    lastSyncStatus: null,
    lastSyncAt: null,
    now,
  });

  assert.equal(health.status, "risk");
  assert.match(health.summary, /aucune plateforme connectée/);
  assert.equal(health.nextAction, "Connecter au moins une plateforme sociale.");
});

test("admin client health treats inactive clients separately", () => {
  const health = computeAdminClientHealth({
    isActive: false,
    platforms: ["instagram"],
    lastSyncStatus: "success",
    lastSyncAt: "2026-06-03T08:00:00Z",
    now,
  });

  assert.equal(health.status, "inactive");
  assert.equal(health.score, 0);
});
