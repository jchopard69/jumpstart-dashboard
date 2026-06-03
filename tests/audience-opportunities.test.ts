import assert from "node:assert/strict";
import { test } from "node:test";

import { buildAudienceOpportunities } from "../lib/audience-opportunities.ts";

const emptyAudience = {
  age: [],
  gender: [],
  country: [],
  city: [],
  function: [],
  seniority: [],
  industry: [],
};

test("audience opportunities turn strong segments into action recommendations", () => {
  const opportunities = buildAudienceOpportunities({
    ...emptyAudience,
    age: [{ dimension: "age", value: "25-34", percentage: 42 }],
    city: [{ dimension: "city", value: "Lyon", percentage: 31 }],
    function: [{ dimension: "function", value: "Founder", percentage: 28 }],
    gender: [{ dimension: "gender", value: "female", percentage: 64 }],
  });

  assert.equal(opportunities.length, 4);
  assert.equal(opportunities[0].id, "audience-core-angle");
  assert.match(opportunities[0].title, /25-34/);
  assert.equal(opportunities[0].confidence, "Haute");
  assert.equal(opportunities[1].id, "localize-content-plan");
  assert.match(opportunities[1].title, /Lyon/);
  assert.equal(opportunities[2].id, "professional-segment-brief");
  assert.equal(opportunities[3].id, "gender-balance-test");
});

test("audience opportunities flag sparse demographic coverage", () => {
  const opportunities = buildAudienceOpportunities({
    ...emptyAudience,
    country: [{ dimension: "country", value: "France", percentage: 18 }],
  });

  assert.equal(opportunities.length, 2);
  assert.equal(opportunities[0].id, "localize-content-plan");
  assert.equal(opportunities[1].id, "improve-audience-coverage");
  assert.match(opportunities[1].evidence, /1\/7/);
});

test("audience opportunities stay hidden when no segment is usable", () => {
  const opportunities = buildAudienceOpportunities(emptyAudience);

  assert.deepEqual(opportunities, [
    {
      id: "improve-audience-coverage",
      title: "Renforcer la lecture audience",
      action: "Vérifier les permissions et pousser la collecte sur les plateformes qui exposent les segments.",
      automation: "Afficher une alerte quand la donnée audience devient trop partielle pour guider les décisions.",
      evidence: "0/7 dimensions disponibles",
      confidence: "Moyenne",
    },
  ]);
});
