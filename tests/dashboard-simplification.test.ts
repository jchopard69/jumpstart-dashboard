import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

test("dashboard no longer renders action plan or client next decisions", () => {
  const dashboard = readFileSync("app/(client)/client/dashboard/page.tsx", "utf8");
  const nav = readFileSync("components/dashboard/dashboard-section-nav.tsx", "utf8");

  assert.doesNotMatch(dashboard, /ActionPlanCard|ClientNextActionsCard|buildDashboardActionPlan|buildClientNextActions/);
  assert.doesNotMatch(dashboard, /dashboard-priorities/);
  assert.match(dashboard, /dashboard-opportunities/);
  assert.match(nav, /Opportunités/);
  assert.doesNotMatch(nav, /Actions, opportunités, stratégie/);
});

test("removed gadget modules are not kept in the dashboard codebase", () => {
  assert.equal(existsSync("components/dashboard/action-plan-card.tsx"), false);
  assert.equal(existsSync("components/dashboard/client-next-actions-card.tsx"), false);
  assert.equal(existsSync("lib/dashboard-action-plan.ts"), false);
  assert.equal(existsSync("lib/client-next-actions.ts"), false);
});

test("pdf and csv exports stay focused on useful signals", () => {
  const pdf = readFileSync("lib/pdf-document.tsx", "utf8");
  const csv = readFileSync("lib/csv-export.ts", "utf8");

  assert.doesNotMatch(pdf, /Plan d'actions|Prochaines décisions client|Briefs éditoriaux générés|contentBriefs|clientNextActions|actionPlan/);
  assert.doesNotMatch(csv, /Priorité V2|Brief automatisable|getAutomatableBrief|getV2Priority/);
});
