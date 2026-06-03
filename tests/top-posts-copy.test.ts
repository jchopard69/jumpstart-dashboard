import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("top posts engagement copy matches the engagement ranking rule", () => {
  const source = readFileSync("components/dashboard/top-posts.tsx", "utf8");

  assert.match(source, /Signal actif/);
  assert.match(source, /Classement par volume d'engagements/);
  assert.doesNotMatch(source, /meilleur taux d'interaction/);
});
