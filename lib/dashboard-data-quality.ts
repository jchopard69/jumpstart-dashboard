import { countCalendarDays, toIsoDate } from "./date";
import type { Platform } from "./types";
import type { DashboardTotals, PlatformData, SyncStatusInfo } from "./types/dashboard";

type AccountLike = {
  id?: string | null;
  platform?: Platform | string | null;
  account_name?: string | null;
};

type MetricLike = {
  date?: string | null;
  platform?: Platform | string | null;
  social_account_id?: string | null;
  followers?: number | null;
  views?: number | null;
  reach?: number | null;
  engagements?: number | null;
  posts_count?: number | null;
};

type PlatformDataLike = Pick<PlatformData, "platform"> & {
  totals: DashboardTotals;
  available?: PlatformData["available"];
};

export type PlatformDataQuality = {
  platform: Platform;
  accounts: number;
  coveredDays: number;
  observedAccountDays?: number;
  expectedAccountDays?: number;
  expectedDays: number;
  coverage: number;
  status: "good" | "partial" | "missing";
  missingMetrics: Array<"views" | "reach" | "engagements">;
};

export type DashboardDataQuality = {
  overallCoverage: number;
  expectedDays: number;
  staleSync: boolean;
  platformQuality: PlatformDataQuality[];
  actions: string[];
};

function getDaysInclusive(range?: { start: Date; end: Date }): number {
  if (!range) return 0;
  return countCalendarDays(range);
}

function hasMetricSignal(row: MetricLike): boolean {
  return [row.followers, row.views, row.reach, row.engagements, row.posts_count]
    .some(value => value != null && Number.isFinite(value) && value >= 0);
}

export function computeDashboardDataQuality(params: {
  range?: { start: Date; end: Date };
  accounts: AccountLike[];
  metrics: MetricLike[];
  perPlatform: PlatformDataLike[];
  lastSync: SyncStatusInfo | null;
}): DashboardDataQuality {
  const expectedDays = getDaysInclusive(params.range);
  const platforms = Array.from(
    new Set(
      [
        ...params.accounts.map((account) => account.platform),
        ...params.perPlatform.map((item) => item.platform),
      ].filter(Boolean) as Platform[]
    )
  );

  const staleSync = (() => {
    if (params.lastSync?.status !== "success" || !params.lastSync.finished_at) return true;
    const finishedAt = new Date(params.lastSync.finished_at);
    if (Number.isNaN(finishedAt.getTime())) return true;
    return Date.now() - finishedAt.getTime() >= 48 * 60 * 60 * 1000;
  })();

  const platformQuality = platforms.map((platform) => {
    const platformAccounts = params.accounts.filter((account) => account.platform === platform);
    const platformRows = params.metrics.filter((row) => row.platform === platform && row.date &&
      (!params.range || (row.date >= toIsoDate(params.range.start) && row.date <= toIsoDate(params.range.end))));
    // Measure account-days, so one populated account cannot hide a missing account.
    const accountIds = platformAccounts.map(account => account.id).filter(Boolean);
    const coveredFor = (id?: string | null) => new Set(platformRows
      .filter(row => hasMetricSignal(row) && (!id || row.social_account_id === id || (accountIds.length === 1 && !row.social_account_id)))
      .map(row => row.date)).size;
    const observedAccountDays = accountIds.length ? accountIds.reduce((sum, id) => sum + coveredFor(id), 0) : coveredFor();
    const expectedAccountDays = expectedDays * Math.max(1, accountIds.length);
    const coveredDays = new Set(platformRows.filter(hasMetricSignal).map(row => row.date)).size;
    const coverage = expectedAccountDays > 0 ? Math.min(100, Math.round(observedAccountDays / expectedAccountDays * 100)) : 0;
    const summary = params.perPlatform.find((item) => item.platform === platform);
    const missingMetrics: PlatformDataQuality["missingMetrics"] = [];

    if (summary?.available?.views && !platformRows.some(row => row.views != null)) missingMetrics.push("views");
    if (summary?.available?.reach && !platformRows.some(row => row.reach != null)) missingMetrics.push("reach");
    if (summary?.available?.engagements && !platformRows.some(row => row.engagements != null)) missingMetrics.push("engagements");

    const status: PlatformDataQuality["status"] =
      coverage >= 80 && missingMetrics.length === 0
        ? "good"
        : coverage === 0 || missingMetrics.length >= 2
          ? "missing"
          : "partial";

    return {
      platform,
      accounts: platformAccounts.length,
      coveredDays,
      observedAccountDays,
      expectedAccountDays,
      expectedDays,
      coverage,
      status,
      missingMetrics,
    };
  });

  const overallCoverage = platformQuality.length
    ? Math.round(platformQuality.reduce((sum, item) => sum + item.coverage, 0) / platformQuality.length)
    : 0;

  const actions: string[] = [];
  if (staleSync) {
    actions.push("Relancer une synchronisation pour rafraîchir les chiffres avant l'analyse client.");
  }
  for (const item of platformQuality) {
    if (item.status === "missing") {
      actions.push(`Vérifier la connexion ${item.platform}: les données exploitables sont absentes ou incomplètes.`);
    } else if (item.status === "partial") {
      actions.push(`Contrôler ${item.platform}: couverture ${item.coverage}% sur la période sélectionnée.`);
    }
  }

  return {
    overallCoverage,
    expectedDays,
    staleSync,
    platformQuality,
    actions: actions.slice(0, 4),
  };
}
