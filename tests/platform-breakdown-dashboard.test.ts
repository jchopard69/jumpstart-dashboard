import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("dashboard exposes a readable per-platform breakdown before channel mix", () => {
  const dashboardPage = readFileSync("app/(client)/client/dashboard/page.tsx", "utf8");
  const breakdownCard = readFileSync("components/dashboard/platform-breakdown-card.tsx", "utf8");
  const mixCard = readFileSync("components/dashboard/platform-mix-card.tsx", "utf8");

  assert.match(dashboardPage, /<PlatformBreakdownCard platforms=\{data\.perPlatform\} \/>/);
  assert.match(breakdownCard, /Détail par plateforme/);
  assert.match(breakdownCard, /Abonnés/);
  assert.match(breakdownCard, /Taux d'eng\./);
  assert.match(breakdownCard, /function formatEvolution/);
  assert.match(breakdownCard, /text-rose-600/);
  assert.match(mixCard, /Les pourcentages comparent chaque plateforme au total de la période/);
  assert.match(mixCard, /Part visibilité/);
  assert.match(mixCard, /Part engagements/);
  assert.doesNotMatch(mixCard, /rateLabel/);
  assert.doesNotMatch(mixCard, /item\.engagementRate/);
});
