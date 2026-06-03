import assert from "node:assert/strict";
import { test } from "node:test";

import { buildAdminClientReadiness } from "../lib/admin-client-readiness.ts";

const now = new Date("2026-06-03T10:00:00Z");
const goodGoals = {
  followers_target: 10000,
  engagement_rate_target: 3.5,
  posts_per_week_target: 4,
  reach_target: 50000,
  views_target: 100000,
};

test("admin client readiness prioritizes missing accounts", () => {
  const readiness = buildAdminClientReadiness({
    accounts: [],
    logs: [],
    goals: null,
    strategyStatus: "risk",
    strategyCoverage: 0,
    highPriorityCollaborationActions: 0,
    now,
  });

  assert.equal(readiness.status, "risk");
  assert.equal(readiness.priorityAnchor, "#accounts");
  assert.equal(readiness.proof, "aucun compte connecté");
});

test("admin client readiness prioritizes broken accounts before sync logs", () => {
  const readiness = buildAdminClientReadiness({
    accounts: [
      {
        auth_status: "expired",
        last_error: null,
        last_sync_at: "2026-06-03T08:00:00Z",
      },
    ],
    logs: [{ status: "failed", started_at: "2026-06-03T08:00:00Z", finished_at: "2026-06-03T08:10:00Z" }],
    goals: goodGoals,
    strategyStatus: "healthy",
    strategyCoverage: 8,
    highPriorityCollaborationActions: 0,
    now,
  });

  assert.equal(readiness.priorityAnchor, "#accounts");
  assert.equal(readiness.risks[0], "1 compte à corriger");
});

test("admin client readiness points to goals when operational data is healthy", () => {
  const readiness = buildAdminClientReadiness({
    accounts: [
      {
        auth_status: "active",
        last_error: null,
        last_sync_at: "2026-06-03T08:00:00Z",
      },
    ],
    logs: [{ status: "success", started_at: "2026-06-03T08:00:00Z", finished_at: "2026-06-03T08:10:00Z" }],
    goals: { ...goodGoals, reach_target: null, views_target: null, posts_per_week_target: null },
    strategyStatus: "healthy",
    strategyCoverage: 8,
    highPriorityCollaborationActions: 0,
    now,
  });

  assert.equal(readiness.priorityAnchor, "#goals");
  assert.ok(readiness.risks.includes("2/5 objectifs configurés"));
});

test("admin client readiness marks fully prepared client as ready", () => {
  const readiness = buildAdminClientReadiness({
    accounts: [
      {
        auth_status: "active",
        last_error: null,
        last_sync_at: "2026-06-03T08:00:00Z",
      },
    ],
    logs: [{ status: "success", started_at: "2026-06-03T08:00:00Z", finished_at: "2026-06-03T08:10:00Z" }],
    goals: goodGoals,
    strategyStatus: "healthy",
    strategyCoverage: 8,
    highPriorityCollaborationActions: 0,
    now,
  });

  assert.equal(readiness.status, "ready");
  assert.equal(readiness.label, "Prêt client");
  assert.equal(readiness.risks.length, 0);
});
