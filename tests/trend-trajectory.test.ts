import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildTrendTrajectory,
  buildTrendTrajectoryFromDailyMetrics,
} from "../lib/trend-trajectory";

test("buildTrendTrajectory summarizes stock and flow series", () => {
  const trajectory = buildTrendTrajectory([
    {
      id: "followers",
      label: "Abonnés",
      mode: "stock",
      points: [
        { date: "2026-01-01", value: 100 },
        { date: "2026-01-02", value: 120 },
      ],
    },
    {
      id: "views",
      label: "Vues",
      points: [
        { date: "2026-01-01", value: 10 },
        { date: "2026-01-02", value: 30 },
      ],
    },
  ]);

  assert.equal(trajectory.length, 2);
  assert.equal(trajectory[0].valueLabel, "120");
  assert.equal(trajectory[0].direction, "up");
  assert.equal(trajectory[1].valueLabel, "40");
  assert.equal(trajectory[1].bars.length, 2);
});

test("buildTrendTrajectoryFromDailyMetrics forward fills followers per account", () => {
  const trajectory = buildTrendTrajectoryFromDailyMetrics([
    {
      date: "2026-01-01",
      social_account_id: "a",
      followers: 100,
      views: 10,
      reach: 8,
      engagements: 2,
    },
    {
      date: "2026-01-02",
      social_account_id: "b",
      followers: 50,
      views: 30,
      reach: 12,
      engagements: 5,
    },
  ]);

  const followers = trajectory.find((item) => item.id === "followers");
  const views = trajectory.find((item) => item.id === "views");

  assert.equal(followers?.valueLabel, "150");
  assert.equal(views?.valueLabel, "40");
});
