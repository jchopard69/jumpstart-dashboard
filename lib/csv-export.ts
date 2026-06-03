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
      Compte: row.social_account_id ? accountNameById.get(row.social_account_id) ?? row.social_account_id : "",
      "Couverture période (%)": coverageByPlatform.get(platform) ?? 0,
      "Dernière synchronisation": syncLabel,
    };
  });
}

