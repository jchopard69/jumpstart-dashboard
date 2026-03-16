import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildMetricDropAlert,
  buildScoreDropAlert,
  detectMetricDrops,
} from "../lib/alerting";

test("detectMetricDrops returns the metrics that materially declined", () => {
  const details = detectMetricDrops({
    current: {
      followers: 940,
      views: 700,
      reach: 600,
      engagements: 180,
    },
    previous: {
      followers: 1000,
      views: 1000,
      reach: 1000,
      engagements: 300,
    },
  });

  assert.deepEqual(
    details.map((detail) => detail.key).sort(),
    ["engagements", "followers", "reach", "views"]
  );
});

test("buildMetricDropAlert ignores low-signal baselines", () => {
  const alert = buildMetricDropAlert({
    current: {
      followers: 30,
      views: 20,
      reach: 15,
      engagements: 5,
    },
    previous: {
      followers: 40,
      views: 25,
      reach: 18,
      engagements: 6,
    },
  });

  assert.equal(alert, null);
});

test("buildMetricDropAlert returns a generic performance warning", () => {
  const alert = buildMetricDropAlert({
    current: {
      followers: 980,
      views: 700,
      reach: 760,
      engagements: 200,
    },
    previous: {
      followers: 1000,
      views: 1000,
      reach: 1000,
      engagements: 300,
    },
  });

  assert.ok(alert);
  assert.equal(alert?.title, "Baisse de performance detectee");
  assert.match(alert?.message ?? "", /vues -30%/i);
  assert.match(alert?.message ?? "", /engagements -33%/i);
});

test("buildScoreDropAlert requires a meaningful drop", () => {
  assert.equal(
    buildScoreDropAlert({
      currentScore: 72,
      previousScore: 78,
      currentGrade: "B+",
      previousGrade: "A",
    }),
    null
  );

  const alert = buildScoreDropAlert({
    currentScore: 64,
    previousScore: 78,
    currentGrade: "B",
    previousGrade: "A",
  });

  assert.ok(alert);
  assert.equal(alert?.title, "Score JumpStart en baisse");
  assert.match(alert?.message ?? "", /78\/100 a 64\/100/);
});
