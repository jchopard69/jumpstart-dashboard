import assert from "node:assert/strict";
import { test } from "node:test";

import { buildAdminOpsCockpit } from "../lib/admin-ops-cockpit.ts";

const now = new Date("2026-06-03T10:00:00Z");

test("admin ops cockpit flags missing clients", () => {
  const cockpit = buildAdminOpsCockpit({
    tenantsCount: 0,
    accountsCount: 0,
    failedSyncCount: 0,
    disconnectedAccountCount: 0,
    unreadNotificationCount: 0,
    latestSyncStatus: null,
    latestSyncAt: null,
    now,
  });

  assert.equal(cockpit.status, "risk");
  assert.equal(cockpit.label, "Setup incomplet");
  assert.equal(cockpit.priorityHref, "/admin/clients");
});

test("admin ops cockpit prioritizes disconnected accounts before sync failures", () => {
  const cockpit = buildAdminOpsCockpit({
    tenantsCount: 4,
    accountsCount: 8,
    failedSyncCount: 2,
    disconnectedAccountCount: 1,
    unreadNotificationCount: 5,
    latestSyncStatus: "failed",
    latestSyncAt: "2026-06-03T08:00:00Z",
    now,
  });

  assert.equal(cockpit.status, "risk");
  assert.equal(cockpit.label, "Connexions à réparer");
  assert.equal(cockpit.proof, "1 compte à reconnecter");
});

test("admin ops cockpit surfaces unread notifications when system is stable", () => {
  const cockpit = buildAdminOpsCockpit({
    tenantsCount: 3,
    accountsCount: 7,
    failedSyncCount: 0,
    disconnectedAccountCount: 0,
    unreadNotificationCount: 4,
    latestSyncStatus: "success",
    latestSyncAt: "2026-06-03T08:00:00Z",
    now,
  });

  assert.equal(cockpit.status, "watch");
  assert.equal(cockpit.label, "Alertes à traiter");
  assert.equal(cockpit.score, 72);
});

test("admin ops cockpit marks recent clean operations as healthy", () => {
  const cockpit = buildAdminOpsCockpit({
    tenantsCount: 5,
    accountsCount: 12,
    failedSyncCount: 0,
    disconnectedAccountCount: 0,
    unreadNotificationCount: 0,
    latestSyncStatus: "success",
    latestSyncAt: "2026-06-03T08:00:00Z",
    now,
  });

  assert.equal(cockpit.status, "healthy");
  assert.equal(cockpit.label, "Ops sous contrôle");
  assert.equal(cockpit.proof, "5 clients, 12 comptes connectés");
});
