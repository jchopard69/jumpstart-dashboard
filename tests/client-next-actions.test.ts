import assert from "node:assert/strict";
import { test } from "node:test";

import { buildClientNextActions } from "../lib/client-next-actions.ts";
import type { ClientStrategySnapshot } from "../lib/client-strategy.ts";

const emptyStrategy: ClientStrategySnapshot = {
  profile: null,
  latestBrief: null,
  actionItems: [],
};

test("client next actions prioritize dashboard risk, opportunity, and strategy action", () => {
  const actions = buildClientNextActions({
    actionPlan: [
      {
        id: "data-tiktok",
        priority: "high",
        horizon: "Aujourd'hui",
        title: "Réparer les données TikTok",
        rationale: "Les décisions clients sont fragilisées tant que cette source n'est pas fiable.",
        metric: "0% de couverture",
      },
    ],
    opportunities: [
      {
        id: "replicate-engagement-winner",
        title: "Répliquer le format gagnant Instagram",
        automation: "Créer automatiquement 3 variations de brief.",
        impact: "Accélérer la production.",
        evidence: "1 800 engagements",
        confidence: "Haute",
      },
    ],
    strategy: {
      ...emptyStrategy,
      actionItems: [
        {
          id: "strategy-1",
          tenant_id: "tenant-1",
          title: "Produire un carrousel preuve",
          rationale: "Renforcer la preuve sociale.",
          expected_impact: "Engagement +10%",
          owner: "shared",
          status: "planned",
          priority: "high",
          due_date: null,
          sort_order: 1,
          created_at: "2026-06-01T00:00:00Z",
          updated_at: "2026-06-01T00:00:00Z",
        },
      ],
    },
    tenantId: "tenant-1",
  });

  assert.equal(actions.length, 3);
  assert.equal(actions[0].id, "dashboard-data-tiktok");
  assert.equal(actions[0].href, "#dashboard-operations");
  assert.equal(actions[1].id, "opportunity-replicate-engagement-winner");
  assert.equal(actions[2].id, "strategy-strategy-1");
  assert.equal(actions[2].href, "/client/strategy?tenantId=tenant-1");
});

test("client next actions use monthly focus when no strategy action is active", () => {
  const actions = buildClientNextActions({
    actionPlan: [],
    opportunities: [],
    strategy: {
      ...emptyStrategy,
      profile: {
        tenant_id: "tenant-1",
        positioning: null,
        target_audience: null,
        offer_focus: null,
        brand_voice: null,
        editorial_pillars: null,
        current_quarter_objectives: null,
        monthly_focus: "Accélérer les formats expertise",
        jumpstart_note: null,
        updated_at: "2026-06-01T00:00:00Z",
      },
    },
  });

  assert.deepEqual(actions.map((action) => action.id), ["strategy-focus"]);
  assert.equal(actions[0].priority, "medium");
});

test("client next actions fall back to a review loop when no signal exists", () => {
  const actions = buildClientNextActions({
    actionPlan: [],
    opportunities: [],
    strategy: emptyStrategy,
  });

  assert.deepEqual(actions, [
    {
      id: "baseline-client-loop",
      label: "Rituel client",
      title: "Valider les apprentissages de la période",
      detail: "Passer en revue les performances, confirmer les formats à conserver et préparer la prochaine itération.",
      proof: "Synthèse dashboard",
      href: "#dashboard-insights",
      priority: "low",
    },
  ]);
});
