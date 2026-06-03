import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { estimateContentIdeasCostUsd } from "../lib/content-ideas-ai";

describe("content ideas AI usage", () => {
  it("estimates gpt-5.4-mini generation cost from input and output tokens", () => {
    assert.equal(
      estimateContentIdeasCostUsd({
        model: "gpt-5.4-mini",
        inputTokens: 4000,
        outputTokens: 1000,
      }),
      0.0075
    );
  });

  it("falls back to the default content ideas model pricing", () => {
    assert.equal(
      estimateContentIdeasCostUsd({
        model: "unknown-model",
        inputTokens: 1000,
        outputTokens: 1000,
      }),
      0.00525
    );
  });
});
