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
  return Math.max(
    1,
    Math.ceil((range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );
}

function hasMetricSignal(row: MetricLike): boolean {
  return (
    (row.followers ?? 0) > 0 ||
    (row.views ?? 0) > 0 ||
    (row.reach ?? 0) > 0 ||
    (row.engagements ?? 0) > 0 ||
    (row.posts_count ?? 0) > 0
  );
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
    if (!params.lastSync?.finished_at) return true;
    const finishedAt = new Date(params.lastSync.finished_at);
    if (Number.isNaN(finishedAt.getTime())) return true;
    return Date.now() - finishedAt.getTime() >= 48 * 60 * 60 * 1000;
  })();

  const platformQuality = platforms.map((platform) => {
    const platformAccounts = params.accounts.filter((account) => account.platform === platform);
    const platformRows = params.metrics.filter((row) => row.platform === platform);
    const coveredDays = new Set(
      platformRows.filter(hasMetricSignal).map((row) => row.date).filter(Boolean)
    ).size;
    const coverage = expectedDays > 0 ? Math.min(100, Math.round((coveredDays / expectedDays) * 100)) : 0;
    const summary = params.perPlatform.find((item) => item.platform === platform);
    const missingMetrics: PlatformDataQuality["missingMetrics"] = [];

    if (summary?.available?.views && (summary.totals.views ?? 0) === 0) missingMetrics.push("views");
    if (summary?.available?.reach && (summary.totals.reach ?? 0) === 0) missingMetrics.push("reach");
    if (summary?.available?.engagements && (summary.totals.engagements ?? 0) === 0) missingMetrics.push("engagements");

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
