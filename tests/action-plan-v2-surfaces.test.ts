import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("dashboard action plan surfaces owner and automation guidance", () => {
  const source = readFileSync("components/dashboard/action-plan-card.tsx", "utf8");

  assert.match(source, /action\.owner/);
  assert.match(source, /action\.automation/);
  assert.match(source, /Bot/);
});

test("pdf action plan includes owner and automation guidance", () => {
  const source = readFileSync("lib/pdf-document.tsx", "utf8");

  assert.match(source, /Responsable recommandé/);
  assert.match(source, /action\.automation/);
  assert.match(source, /actionAutomation/);
});
