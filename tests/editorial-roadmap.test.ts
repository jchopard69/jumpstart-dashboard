import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEditorialRoadmap } from "../lib/editorial-roadmap";
const posts = (rates: number[], platform = "instagram") => rates.map(rate => ({ platform, media_type: "video", metrics: { views: 1000, engagements: rate * 10 } }));
test("roadmap reports the median of a comparable group, not a pooled cross-platform rate", () => {
  const plan = buildEditorialRoadmap([...posts([1, 2, 9]), ...posts([50, 70], "linkedin")], 100);
  assert.match(plan[0].evidence, /3 contenus video sur instagram/);
  assert.match(plan[0].evidence, /2.0%/);
  assert.equal(plan.length, 4);
});
test("roadmap requires adequate coverage and three measured posts", () => {
  assert.equal(buildEditorialRoadmap(posts([1, 2, 3]), 50)[0].title, "Établir une référence fiable");
  assert.equal(buildEditorialRoadmap(posts([1, 2]), 100)[0].title, "Établir une référence fiable");
  const missing = Array.from({ length: 3 }, () => ({ platform: "instagram", media_type: "video", metrics: { views: 1000 } }));
  assert.equal(buildEditorialRoadmap(missing, 100)[0].title, "Établir une référence fiable");
});
test("measured zero interactions remain a valid observation", () => {
  assert.match(buildEditorialRoadmap(posts([0, 0, 0]), 100)[0].evidence, /0.0%/);
});
