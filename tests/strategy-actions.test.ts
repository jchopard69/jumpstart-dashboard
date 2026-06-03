import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseStrategyActionOwner,
  parseStrategyActionPriority,
  parseStrategyActionStatus,
} from "../lib/strategy-actions.ts";

test("strategy action parsers accept supported enum values", () => {
  assert.equal(parseStrategyActionStatus("in_progress"), "in_progress");
  assert.equal(parseStrategyActionPriority("critical"), "critical");
  assert.equal(parseStrategyActionOwner("shared"), "shared");
});

test("strategy action parsers reject unsupported values", () => {
  assert.throws(() => parseStrategyActionStatus("archived"), /statut/i);
  assert.throws(() => parseStrategyActionPriority("urgent"), /priorité/i);
  assert.throws(() => parseStrategyActionOwner("agency"), /responsable/i);
});
