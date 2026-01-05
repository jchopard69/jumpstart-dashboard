import { addDays, endOfDay, formatISO, startOfDay, subDays } from "date-fns";

export type DateRangePreset =
  | "last_7_days"
  | "last_30_days"
  | "last_90_days"
  | "last_365_days"
  | "this_month"
  | "last_month"
  | "custom";

export function resolveDateRange(preset: DateRangePreset, from?: string, to?: string) {
  const now = new Date();
  let start: Date;
  let end: Date;

  switch (preset) {
    case "last_7_days":
      start = subDays(now, 6);
      end = now;
      break;
    case "last_30_days":
      start = subDays(now, 29);
      end = now;
      break;
    case "last_90_days":
      start = subDays(now, 89);
      end = now;
      break;
    case "last_365_days":
      start = subDays(now, 364);
      end = now;
      break;
    case "this_month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = now;
      break;
    case "last_month": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      start = first;
      end = last;
      break;
    }
    case "custom":
    default:
      start = from ? new Date(from) : subDays(now, 6);
      end = to ? new Date(to) : now;
  }

  return {
    start: startOfDay(start),
    end: endOfDay(end)
  };
}

export function toIsoDate(date: Date) {
  return formatISO(date, { representation: "date" });
}

export function toUtcRange(range: { start: Date; end: Date }) {
  return {
    startUtc: range.start.toISOString(),
    endUtc: range.end.toISOString()
  };
}

export function buildPreviousRange(range: { start: Date; end: Date }) {
  const diffDays = Math.round(
    (range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24)
  );
  const prevEnd = subDays(range.start, 1);
  const prevStart = subDays(prevEnd, diffDays);
  return { start: startOfDay(prevStart), end: endOfDay(prevEnd) };
}

export function eachDay(range: { start: Date; end: Date }) {
  const days: Date[] = [];
  let current = startOfDay(range.start);
  while (current <= range.end) {
    days.push(current);
    current = addDays(current, 1);
  }
  return days;
}
