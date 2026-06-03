import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("skeleton UI avoids nondeterministic render output", () => {
  const source = readFileSync("components/ui/skeleton.tsx", "utf8");

  assert.doesNotMatch(source, /Math\.random/);
  assert.match(source, /aria-hidden="true"/);
});
