import assert from "node:assert/strict";
import { test } from "node:test";

import { analyzeContentDna } from "../lib/content-dna.ts";

test("content DNA surfaces winning patterns without automated briefs", () => {
  const dna = analyzeContentDna({
    posts: [
      {
        media_type: "reel",
        posted_at: "2026-06-01T18:00:00.000Z",
        caption: "Une preuve terrain simple avec un call to action clair.",
        metrics: { engagements: 420, impressions: 9_000 },
      },
      {
        media_type: "reel",
        posted_at: "2026-06-02T19:00:00.000Z",
        caption: "Un avant apres client avec une question finale.",
        metrics: { engagements: 510, impressions: 11_000 },
      },
      {
        media_type: "reel",
        posted_at: "2026-06-03T18:30:00.000Z",
        caption: "La methode concrete en trois etapes pour progresser.",
        metrics: { engagements: 470, impressions: 10_200 },
      },
      {
        media_type: "image",
        posted_at: "2026-06-04T09:00:00.000Z",
        caption: "Post court.",
        metrics: { engagements: 80, impressions: 3_000 },
      },
      {
        media_type: "image",
        posted_at: "2026-06-05T09:30:00.000Z",
        caption: "Autre post court.",
        metrics: { engagements: 70, impressions: 2_800 },
      },
    ],
  });

  assert.equal(dna.topFormat, "Reels");
  assert.equal(dna.bestTimeWindow, "18h–22h");
  assert.equal(dna.patterns.length, 2);
  assert.equal("briefs" in dna, false);
});

test("content DNA stays focused when there is not enough signal", () => {
  const dna = analyzeContentDna({
    posts: [
      { media_type: "image", metrics: { engagements: 10 } },
      { media_type: "video", metrics: { engagements: 12 } },
    ],
  });

  assert.deepEqual(dna.patterns, []);
  assert.equal("briefs" in dna, false);
});
