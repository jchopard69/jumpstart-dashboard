import type { Platform } from "./types";

type CsvMetricRow = {
  date: string | null;
  platform: Platform | string | null;
  social_account_id?: string | null;
  followers?: number | null;
  impressions?: number | null;
  reach?: number | null;
  engagements?: number | null;
  views?: number | null;
  watch_time?: number | null;
  posts_count?: number | null;
};

type CsvAccount = {
  id: string;
  account_name: string | null;
};

type SyncInfo = {
  status?: string | null;
  finished_at?: string | null;
} | null;

function hasMetricSignal(row: CsvMetricRow): boolean {
  return (
    (row.followers ?? 0) > 0 ||
    (row.impressions ?? 0) > 0 ||
    (row.reach ?? 0) > 0 ||
    (row.engagements ?? 0) > 0 ||
    (row.views ?? 0) > 0 ||
    (row.posts_count ?? 0) > 0
  );
}

function getCoverageByPlatform(rows: CsvMetricRow[], expectedDays: number) {
  const daysByPlatform = new Map<string, Set<string>>();

  for (const row of rows) {
    if (!row.platform || !row.date || !hasMetricSignal(row)) continue;
    const platform = String(row.platform);
    const days = daysByPlatform.get(platform) ?? new Set<string>();
    days.add(row.date);
    daysByPlatform.set(platform, days);
  }

  const coverage = new Map<string, number>();
  for (const [platform, days] of daysByPlatform.entries()) {
    coverage.set(
      platform,
      expectedDays > 0 ? Math.min(100, Math.round((days.size / expectedDays) * 100)) : 0
    );
  }
  return coverage;
}

function computeRowEngagementRate(row: CsvMetricRow): number | null {
  const engagements = row.engagements ?? 0;
  const views = row.views ?? 0;
  const reach = row.reach ?? 0;
  if (views > 0) return (engagements / views) * 100;
  if (reach > 0) return (engagements / reach) * 100;
  return null;
}

function getDataStatus(coverage: number, row: CsvMetricRow): string {
  if (coverage < 50) return "Données à fiabiliser";
  if ((row.views ?? 0) === 0 && (row.reach ?? 0) === 0 && (row.impressions ?? 0) === 0) {
    return "Visibilité manquante";
  }
  if ((row.engagements ?? 0) === 0) return "Engagement manquant";
  if (coverage < 80) return "Couverture partielle";
  return "Exploitable";
}

function getAutomatedRecommendation(row: CsvMetricRow, coverage: number): string {
  const rate = computeRowEngagementRate(row);
  if (coverage < 50) return "Vérifier la synchronisation avant analyse";
  if ((row.posts_count ?? 0) === 0 && hasMetricSignal(row)) return "Contrôler le volume de publications";
  if ((row.views ?? 0) === 0 && (row.reach ?? 0) === 0 && (row.impressions ?? 0) === 0) {
    return "Reconnecter ou contrôler les permissions de visibilité";
  }
  if (rate != null && rate >= 5 && (row.engagements ?? 0) >= 20) return "Capitaliser sur ce créneau ou format";
  if ((row.engagements ?? 0) === 0 && ((row.views ?? 0) > 0 || (row.reach ?? 0) > 0)) {
    return "Tester un angle plus engageant";
  }
  return "Suivre dans le prochain reporting";
}

export function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const stringValue = String(value ?? "");
    if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };
  const headerLine = headers.join(",");
  const lines = rows.map((row) => headers.map((header) => escape(row[header])).join(","));
  return [headerLine, ...lines].join("\n");
}

export function buildMetricCsvRows(params: {
  rows: CsvMetricRow[];
  accounts: CsvAccount[];
  expectedDays: number;
  lastSync: SyncInfo;
}) {
  const accountNameById = new Map(params.accounts.map((account) => [account.id, account.account_name]));
  const coverageByPlatform = getCoverageByPlatform(params.rows, params.expectedDays);
  const syncLabel = params.lastSync?.finished_at
    ? `${params.lastSync.status ?? "inconnu"} - ${params.lastSync.finished_at}`
    : params.lastSync?.status ?? "inconnu";

  return params.rows.map((row) => {
    const platform = row.platform ? String(row.platform) : "";
    const coverage = coverageByPlatform.get(platform) ?? 0;
    const engagementRate = computeRowEngagementRate(row);
    return {
      Date: row.date,
      Plateforme: platform,
      Abonnés: row.followers ?? 0,
      Impressions: row.impressions ?? 0,
      Portée: row.reach ?? 0,
      Engagements: row.engagements ?? 0,
      Vues: row.views ?? 0,
      "Temps de visionnage (min)": row.watch_time ? Math.round(row.watch_time / 60) : 0,
      Publications: row.posts_count ?? 0,
      "Taux d'engagement (%)": engagementRate == null ? "" : Math.round(engagementRate * 10) / 10,
      Compte: row.social_account_id ? accountNameById.get(row.social_account_id) ?? row.social_account_id : "",
      "Couverture période (%)": coverage,
      "Statut donnée": getDataStatus(coverage, row),
      "Recommandation automatique": getAutomatedRecommendation(row, coverage),
      "Dernière synchronisation": syncLabel,
    };
  });
}
