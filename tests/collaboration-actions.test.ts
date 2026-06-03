import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCollaborationNextActions } from "../lib/collaboration-actions.ts";

const now = new Date("2026-06-03T10:00:00Z");

test("collaboration actions prioritize exhausted shoot days", () => {
  const actions = buildCollaborationNextActions({
    collaboration: {
      shoot_days_remaining: 0,
      notes: "Dernier point client",
      updated_at: "2026-06-01T10:00:00Z",
    },
    shoots: [],
    documents: [],
    now,
  });

  assert.equal(actions[0].id, "collaboration-plan-shoot-days");
  assert.equal(actions[0].priority, "high");
  assert.equal(actions[0].href, "#collaboration-shoots");
});

test("collaboration actions surface upcoming shoot and pinned documents", () => {
  const actions = buildCollaborationNextActions({
    collaboration: {
      shoot_days_remaining: 3,
      notes: "Brief validé",
      updated_at: "2026-06-01T10:00:00Z",
    },
    shoots: [
      {
        id: "shoot-1",
        shoot_date: "2026-06-05",
        location: "Studio Paris",
        notes: "Capsules produit",
      },
    ],
    documents: [
      {
        id: "doc-1",
        file_name: "Brief tournage.pdf",
        tag: "brief",
        created_at: "2026-06-02T10:00:00Z",
        pinned: true,
      },
    ],
    now,
  });

  assert.deepEqual(actions.map((action) => action.id), [
    "collaboration-prepare-next-shoot",
    "collaboration-review-pinned-documents",
  ]);
  assert.equal(actions[0].priority, "high");
  assert.equal(actions[1].href, "#collaboration-documents");
});

test("collaboration actions ask for stale notes refresh", () => {
  const actions = buildCollaborationNextActions({
    collaboration: {
      shoot_days_remaining: 2,
      notes: "Ancien point",
      updated_at: "2026-05-01T10:00:00Z",
    },
    shoots: [
      {
        id: "shoot-1",
        shoot_date: "2026-06-30",
        location: "Lyon",
        notes: null,
      },
    ],
    documents: [],
    now,
  });

  assert.equal(actions[0].id, "collaboration-refresh-notes");
  assert.equal(actions[0].priority, "medium");
  assert.equal(actions[0].proof, "Dernière mise à jour il y a 33 jours");
});

test("collaboration actions fall back to healthy loop", () => {
  const actions = buildCollaborationNextActions({
    collaboration: {
      shoot_days_remaining: 4,
      notes: "Tout est à jour",
      updated_at: "2026-06-02T10:00:00Z",
    },
    shoots: [
      {
        id: "shoot-1",
        shoot_date: "2026-06-20",
        location: "Marseille",
        notes: null,
      },
    ],
    documents: [],
    now,
  });

  assert.deepEqual(actions, [
    {
      id: "collaboration-healthy-loop",
      label: "Suivi",
      title: "Continuer le rythme de production",
      detail: "Le planning, les livrables et le carnet de bord sont suffisamment à jour pour garder le suivi fluide.",
      proof: "Collaboration à jour",
      href: "#collaboration-shoots",
      priority: "low",
    },
  ]);
});
