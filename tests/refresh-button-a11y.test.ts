import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("refresh button exposes sync state accessibly", () => {
  const source = readFileSync("components/dashboard/refresh-button.tsx", "utf8");

  assert.match(source, /aria-busy=\{loading\}/);
  assert.match(source, /Synchronisation du dashboard en cours/);
  assert.match(source, /aria-hidden="true"/);
});
