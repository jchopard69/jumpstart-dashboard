import assert from "node:assert/strict";
import { test } from "node:test";

import { buildStrategyHealth } from "../lib/strategy-health.ts";
import type { ClientStrategySnapshot, StrategyActionItem } from "../lib/client-strategy.ts";

const now = new Date("2026-06-03T10:00:00Z");

const baseAction: StrategyActionItem = {
  id: "action-1",
  tenant_id: "tenant-1",
  title: "Produire un carrousel preuve",
  rationale: null,
  expected_impact: null,
  owner: "shared",
  status: "planned",
  priority: "medium",
  due_date: null,
  sort_order: 1,
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
};

const fullProfile: NonNullable<ClientStrategySnapshot["profile"]> = {
  tenant_id: "tenant-1",
  positioning: "Marque premium locale",
  target_audience: "Décideurs B2B",
  offer_focus: "Offre acquisition",
  brand_voice: "Direct et expert",
  editorial_pillars: "Preuve\nÉducation\nCoulisses",
  current_quarter_objectives: "Accélérer les demandes entrantes",
  monthly_focus: "Renforcer les formats preuve",
  jumpstart_note: "Prioriser les contenus à impact commercial",
  updated_at: "2026-06-01T00:00:00Z",
};

const recentBrief: NonNullable<ClientStrategySnapshot["latestBrief"]> = {
  id: "brief-1",
  tenant_id: "tenant-1",
  period_month: "2026-06-01",
  title: "Brief juin",
  executive_summary: "Synthèse",
  wins: null,
  learnings: null,
  next_focus: "Formats preuve",
  client_requests: null,
  jumpstart_actions: null,
  is_published: true,
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
};

test("strategy health flags empty strategic workspace", () => {
  const health = buildStrategyHealth({
    snapshot: { profile: null, latestBrief: null, actionItems: [] },
    now,
  });

  assert.equal(health.status, "risk");
  assert.equal(health.label, "À cadrer");
  assert.equal(health.coverage, 0);
});

test("strategy health flags incomplete profile before action risks", () => {
  const health = buildStrategyHealth({
    snapshot: {
      profile: { ...fullProfile, offer_focus: null, editorial_pillars: null, current_quarter_objectives: null, monthly_focus: null, jumpstart_note: null },
      latestBrief: recentBrief,
      actionItems: [{ ...baseAction, priority: "critical" }],
    },
    now,
  });

  assert.equal(health.status, "risk");
  assert.equal(health.label, "Cadre incomplet");
  assert.equal(health.proof, "3/8 blocs renseignés");
});

test("strategy health detects urgent critical actions", () => {
  const health = buildStrategyHealth({
    snapshot: {
      profile: fullProfile,
      latestBrief: recentBrief,
      actionItems: [{ ...baseAction, priority: "critical" }],
    },
    now,
  });

  assert.equal(health.status, "risk");
  assert.equal(health.label, "Priorité critique");
  assert.equal(health.urgentActions, 1);
});

test("strategy health marks complete active strategy as healthy", () => {
  const health = buildStrategyHealth({
    snapshot: {
      profile: fullProfile,
      latestBrief: recentBrief,
      actionItems: [baseAction, { ...baseAction, id: "done-1", status: "done" }],
    },
    now,
  });

  assert.equal(health.status, "healthy");
  assert.equal(health.label, "Direction claire");
  assert.equal(health.score, 94);
  assert.equal(health.completedActions, 1);
});
