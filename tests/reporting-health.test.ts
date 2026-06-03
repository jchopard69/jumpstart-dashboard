import assert from "node:assert/strict";
import { test } from "node:test";

import { buildReportingHealth } from "../lib/reporting-health.ts";

const now = new Date("2026-06-03T10:00:00Z");

test("reporting health flags missing schedules", () => {
  const health = buildReportingHealth({ schedules: [], now });

  assert.equal(health.status, "risk");
  assert.equal(health.label, "À configurer");
  assert.equal(health.nextAction, "Créer un envoi hebdomadaire avec les décideurs et l'équipe opérationnelle.");
  assert.equal(health.activeCount, 0);
});

test("reporting health flags inactive schedules", () => {
  const health = buildReportingHealth({
    now,
    schedules: [
      {
        id: "schedule-1",
        frequency: "weekly",
        recipients: ["client@example.com"],
        is_active: false,
        last_sent_at: null,
        next_send_at: "2026-06-07T08:00:00Z",
      },
    ],
  });

  assert.equal(health.status, "risk");
  assert.equal(health.label, "Inactif");
  assert.equal(health.proof, "1 rapport inactif");
});

test("reporting health detects overdue active send", () => {
  const health = buildReportingHealth({
    now,
    schedules: [
      {
        id: "schedule-1",
        frequency: "weekly",
        recipients: ["client@example.com", " Client@example.com "],
        is_active: true,
        last_sent_at: "2026-05-20T08:00:00Z",
        next_send_at: "2026-06-01T08:00:00Z",
      },
    ],
  });

  assert.equal(health.status, "risk");
  assert.equal(health.label, "Envoi en retard");
  assert.equal(health.recipientCount, 1);
  assert.equal(health.proof, "En retard de 2 jours");
});

test("reporting health marks weekly active rhythm as healthy", () => {
  const health = buildReportingHealth({
    now,
    schedules: [
      {
        id: "schedule-1",
        frequency: "weekly",
        recipients: ["client@example.com", "ops@example.com"],
        is_active: true,
        last_sent_at: "2026-05-31T08:00:00Z",
        next_send_at: "2026-06-07T08:00:00Z",
      },
    ],
  });

  assert.equal(health.status, "healthy");
  assert.equal(health.label, "Rituel actif");
  assert.equal(health.score, 92);
  assert.equal(health.proof, "1 actif, 2 destinataires");
});
