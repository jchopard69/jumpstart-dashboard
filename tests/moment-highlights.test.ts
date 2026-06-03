import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMomentHighlights } from "../lib/moment-highlights";

test("moment highlights detect standout days and attach same-day content", () => {
  const highlights = buildMomentHighlights({
    metrics: [
      { date: "2026-05-01", views: 100, reach: 0, engagements: 10, followers: 0 },
      { date: "2026-05-02", views: 120, reach: 0, engagements: 12, followers: 0 },
      { date: "2026-05-03", views: 950, reach: 0, engagements: 160, followers: 0 },
      { date: "2026-05-04", views: 90, reach: 0, engagements: 8, followers: 0 },
    ],
    posts: [
      {
        id: "post-1",
        platform: "instagram",
        media_type: "reel",
        thumbnail_url: null,
        caption: "Coulisses du lancement de la campagne avec l'equipe terrain",
        posted_at: "2026-05-03T08:30:00.000Z",
        url: "https://example.com/post-1",
        metrics: { views: 900, likes: 120, comments: 18, shares: 8 },
      },
    ],
  });

  assert.equal(highlights.length, 1);
  assert.equal(highlights[0].date, "2026-05-03");
  assert.equal(highlights[0].topPost?.platform, "instagram");
  assert.match(highlights[0].summary, /Coulisses du lancement/);
});

test("moment highlights stay hidden without enough daily signal", () => {
  const highlights = buildMomentHighlights({
    metrics: [
      { date: "2026-05-01", views: 100, reach: 0, engagements: 10, followers: 0 },
      { date: "2026-05-02", views: 110, reach: 0, engagements: 9, followers: 0 },
    ],
    posts: [],
  });

  assert.deepEqual(highlights, []);
});
