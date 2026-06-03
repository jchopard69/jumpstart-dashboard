import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("export buttons expose loading state accessibly", () => {
  const source = readFileSync("components/dashboard/export-buttons.tsx", "utf8");

  assert.match(source, /aria-busy=\{loadingPdf\}/);
  assert.match(source, /aria-busy=\{loadingCsv\}/);
  assert.match(source, /Export PDF en cours\./);
  assert.match(source, /Export CSV en cours\./);
});
