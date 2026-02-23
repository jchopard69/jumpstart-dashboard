import type { Platform } from "./types";

export function normalizeDashboardFilters(params: {
  platform?: Platform | "all";
  socialAccountId?: string;
}) {
  const platform = params.platform && params.platform !== "all" ? params.platform : null;
  const socialAccountId = params.socialAccountId && params.socialAccountId !== "all"
    ? params.socialAccountId
    : null;

  return { platform, socialAccountId };
}
