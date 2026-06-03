import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("top posts engagement copy matches the engagement ranking rule", () => {
  const source = readFileSync("components/dashboard/top-posts.tsx", "utf8");

  assert.match(source, /Signal actif/);
  assert.match(source, /Classement par volume d'engagements/);
  assert.doesNotMatch(source, /meilleur taux d'interaction/);
});

test("top posts explain the active ranking with an automated next step", () => {
  const source = readFileSync("components/dashboard/top-posts.tsx", "utf8");

  assert.match(source, /Diagnostic automatique/);
  assert.match(source, /Prochaine action/);
  assert.match(source, /modeInsight\.signal/);
  assert.match(source, /modeInsight\.nextStep/);
});
