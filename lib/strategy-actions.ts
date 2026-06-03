import type { StrategyActionItem } from "./client-strategy";

export const STRATEGY_ACTION_STATUSES = [
  "recommended",
  "planned",
  "in_progress",
  "done",
  "paused",
] as const satisfies readonly StrategyActionItem["status"][];

export const STRATEGY_ACTION_PRIORITIES = [
  "low",
  "medium",
  "high",
  "critical",
] as const satisfies readonly StrategyActionItem["priority"][];

export const STRATEGY_ACTION_OWNERS = [
  "jumpstart",
  "client",
  "shared",
] as const satisfies readonly StrategyActionItem["owner"][];

export function parseStrategyActionStatus(value: FormDataEntryValue | null): StrategyActionItem["status"] {
  const normalized = String(value ?? "").trim();
  if (STRATEGY_ACTION_STATUSES.includes(normalized as StrategyActionItem["status"])) {
    return normalized as StrategyActionItem["status"];
  }
  throw new Error("Statut d'action invalide.");
}

export function parseStrategyActionPriority(value: FormDataEntryValue | null): StrategyActionItem["priority"] {
  const normalized = String(value ?? "").trim();
  if (STRATEGY_ACTION_PRIORITIES.includes(normalized as StrategyActionItem["priority"])) {
    return normalized as StrategyActionItem["priority"];
  }
  throw new Error("Priorité d'action invalide.");
}

export function parseStrategyActionOwner(value: FormDataEntryValue | null): StrategyActionItem["owner"] {
  const normalized = String(value ?? "").trim();
  if (STRATEGY_ACTION_OWNERS.includes(normalized as StrategyActionItem["owner"])) {
    return normalized as StrategyActionItem["owner"];
  }
  throw new Error("Responsable d'action invalide.");
}
