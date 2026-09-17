import { subDays } from "date-fns";
import { resolveDateRange, toIsoDate } from "./date";

/** Monthly means the last completed calendar month; weekly excludes the current day. */
export function getScheduledReportPeriod(frequency: "weekly" | "monthly", now = new Date()) {
  const range = frequency === "monthly"
    ? resolveDateRange("last_month", undefined, undefined, now)
    : resolveDateRange("custom", toIsoDate(subDays(now, 7)), toIsoDate(subDays(now, 1)), now);
  return { from: toIsoDate(range.start), to: toIsoDate(range.end) };
}
