import assert from "node:assert/strict";
import { test } from "node:test";

import { buildClientPulse } from "../lib/client-pulse-core.ts";

test("client pulse prioritizes unread alerts", () => {
  const pulse = buildClientPulse({
    score: 86,
    grade: "A",
    unreadNotifications: 2,
    activeActions: 0,
    lastSyncStatus: "success",
    lastSyncAt: new Date().toISOString(),
  });

  assert.equal(pulse.status, "attention");
  assert.equal(pulse.nextHref, "/client/dashboard");
  assert.equal(pulse.nextLabel, "Voir les alertes");
});

test("client pulse routes active strategic actions to strategy", () => {
  const pulse = buildClientPulse({
    score: 82,
    grade: "A",
    unreadNotifications: 0,
    activeActions: 3,
    lastSyncStatus: "success",
    lastSyncAt: new Date().toISOString(),
  });

  assert.equal(pulse.status, "watch");
  assert.equal(pulse.headline, "3 actions stratégiques");
  assert.equal(pulse.nextHref, "/client/strategy");
});

test("client pulse marks stable accounts as healthy", () => {
  const pulse = buildClientPulse({
    score: 91,
    grade: "A+",
    unreadNotifications: 0,
    activeActions: 0,
    lastSyncStatus: "success",
    lastSyncAt: new Date().toISOString(),
  });

  assert.equal(pulse.status, "healthy");
  assert.equal(pulse.nextHref, "/client/reports");
});
