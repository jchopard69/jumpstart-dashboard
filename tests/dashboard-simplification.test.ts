import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

test("dashboard keeps the score and groups recommendations in a single editorial roadmap", () => {
  const dashboard = readFileSync("app/(client)/client/dashboard/page.tsx", "utf8");
  const nav = readFileSync("components/dashboard/dashboard-section-nav.tsx", "utf8");

  assert.doesNotMatch(dashboard, /ActionPlanCard|ClientNextActionsCard|buildDashboardActionPlan|buildClientNextActions/);
  assert.doesNotMatch(dashboard, /dashboard-priorities/);
  assert.match(dashboard, /<ScoreCard/);
  assert.match(dashboard, /<EditorialRoadmap/);
  assert.doesNotMatch(dashboard, /<OpportunityCard|<PlatformDiagnosisCard/);
  assert.match(nav, /Prochaines semaines/);
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
  assert.doesNotMatch(pdf, /Opportunités automatiques/);
  assert.doesNotMatch(csv, /Priorité V2|Brief automatisable|getAutomatableBrief|getV2Priority/);
});

test("Content DNA stays in the dashboard while both exports share report preparation", () => {
  const dashboard = readFileSync("app/(client)/client/dashboard/page.tsx", "utf8");
  const pdf = readFileSync("app/api/export/pdf/route.ts", "utf8");
  const scheduler = readFileSync("lib/report-scheduler.ts", "utf8");
  const preparation = readFileSync("lib/prepare-report.ts", "utf8");

  assert.match(dashboard, /ContentDnaCard/);
  assert.match(dashboard, /analyzeContentDna/);
  assert.match(pdf, /prepareReport/);
  assert.match(scheduler, /prepareReport/);
  assert.doesNotMatch(preparation, /analyzeContentDna|buildPlatformDiagnosis|buildDashboardOpportunities/);
});

test("opportunity card keeps a premium empty state without adding gadget features", () => {
  const source = readFileSync("components/dashboard/opportunity-card.tsx", "utf8");

  assert.match(source, /Opportunités prioritaires/);
  assert.match(source, /Aucun levier fiable détecté/);
  assert.doesNotMatch(source, /Briefs automatisés|Prochaines décisions client|Plan d'actions/);
});
