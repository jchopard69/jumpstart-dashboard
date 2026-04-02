import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const PAGE_PADDING_X = 34;
const PAGE_PADDING_TOP = 76;
const PAGE_PADDING_BOTTOM = 44;

const palette = {
  ink: "#0f172a",
  muted: "#64748b",
  subtle: "#94a3b8",
  line: "#dbe4ee",
  lineSoft: "#e8eef5",
  surface: "#f8fafc",
  surfaceStrong: "#eef4ff",
  navy: "#0f172a",
  blue: "#2563eb",
  blueSoft: "#dbeafe",
  teal: "#0f766e",
  tealSoft: "#ccfbf1",
  amber: "#b45309",
  amberSoft: "#fef3c7",
  red: "#dc2626",
  redSoft: "#fee2e2",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: PAGE_PADDING_TOP,
    paddingBottom: PAGE_PADDING_BOTTOM,
    paddingHorizontal: PAGE_PADDING_X,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: palette.ink,
    backgroundColor: "#ffffff",
  },
  header: {
    position: "absolute",
    top: 20,
    left: PAGE_PADDING_X,
    right: PAGE_PADDING_X,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  headerBrand: {
    fontSize: 8,
    color: palette.muted,
    textTransform: "uppercase",
    letterSpacing: 2.2,
  },
  headerTenant: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: palette.ink,
  },
  headerMeta: {
    fontSize: 8,
    color: palette.subtle,
    textAlign: "right",
    marginTop: 2,
  },
  footer: {
    position: "absolute",
    bottom: 14,
    left: PAGE_PADDING_X,
    right: PAGE_PADDING_X,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: palette.lineSoft,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerNote: {
    fontSize: 8,
    color: palette.subtle,
    width: "72%",
  },
  footerPage: {
    fontSize: 8,
    color: palette.subtle,
    textAlign: "right",
  },
  watermark: {
    position: "absolute",
    top: "43%",
    left: "18%",
    fontSize: 74,
    fontFamily: "Helvetica-Bold",
    color: "#94a3b8",
    opacity: 0.12,
    letterSpacing: 4,
  },
  hero: {
    backgroundColor: palette.navy,
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
  },
  heroEyebrow: {
    fontSize: 8,
    color: "#bfdbfe",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 1.15,
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
  },
  heroSubtitle: {
    marginTop: 5,
    fontSize: 8.4,
    lineHeight: 1.35,
    color: "#cbd5e1",
  },
  heroFactsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
    marginLeft: -4,
    marginRight: -4,
  },
  heroFactCell: {
    width: "25%",
    paddingLeft: 4,
    paddingRight: 4,
    marginBottom: 8,
  },
  heroFact: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 8,
  },
  heroFactLabel: {
    fontSize: 7,
    color: "#93c5fd",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  heroFactValue: {
    fontSize: 11,
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
  },
  row: {
    flexDirection: "row",
    marginLeft: -5,
    marginRight: -5,
  },
  colLeft: {
    width: "39%",
    paddingLeft: 5,
    paddingRight: 5,
  },
  colRight: {
    width: "61%",
    paddingLeft: 5,
    paddingRight: 5,
  },
  panel: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 16,
    padding: 16,
    backgroundColor: "#ffffff",
  },
  scorePanel: {
    borderWidth: 1,
    borderColor: "#bfd4ff",
    borderRadius: 14,
    padding: 12,
    backgroundColor: palette.surfaceStrong,
  },
  panelEyebrow: {
    fontSize: 7,
    color: palette.muted,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 28,
    color: palette.blue,
    fontFamily: "Helvetica-Bold",
  },
  scoreGrade: {
    fontSize: 10,
    color: palette.teal,
    fontFamily: "Helvetica-Bold",
    marginTop: 2,
    marginBottom: 8,
  },
  scoreSummary: {
    fontSize: 7.7,
    lineHeight: 1.35,
    color: palette.ink,
  },
  subScoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  subScoreLabel: {
    fontSize: 8,
    color: palette.muted,
  },
  subScoreValue: {
    fontSize: 8,
    color: palette.ink,
    fontFamily: "Helvetica-Bold",
  },
  progressTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: "#dbeafe",
    marginTop: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: 5,
    borderRadius: 999,
    backgroundColor: palette.blue,
  },
  takeawayCard: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#ffffff",
    minHeight: 164,
  },
  takeawayItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  takeawayBullet: {
    width: 16,
    height: 16,
    borderRadius: 999,
    marginRight: 8,
    backgroundColor: palette.blueSoft,
    color: palette.blue,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    paddingTop: 2,
  },
  takeawayText: {
    flexGrow: 1,
    flexShrink: 1,
    fontSize: 8,
    lineHeight: 1.35,
    color: palette.ink,
  },
  section: {
    marginTop: 10,
  },
  sectionEyebrow: {
    fontSize: 7,
    color: palette.blue,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: palette.ink,
    marginBottom: 3,
  },
  sectionLead: {
    fontSize: 7.8,
    lineHeight: 1.35,
    color: palette.muted,
    marginBottom: 7,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginLeft: -5,
    marginRight: -5,
  },
  metricCell: {
    width: "33.3333%",
    paddingLeft: 5,
    paddingRight: 5,
    marginBottom: 6,
  },
  metricCard: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    padding: 10,
    minHeight: 64,
    backgroundColor: "#ffffff",
  },
  metricLabel: {
    fontSize: 7,
    color: palette.muted,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  metricValueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  metricValue: {
    fontSize: 16,
    lineHeight: 1.1,
    fontFamily: "Helvetica-Bold",
    color: palette.ink,
    maxWidth: "66%",
  },
  deltaPill: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  deltaPillPositive: {
    backgroundColor: palette.tealSoft,
  },
  deltaPillNegative: {
    backgroundColor: palette.redSoft,
  },
  deltaPillNeutral: {
    backgroundColor: "#e2e8f0",
  },
  deltaPillTextPositive: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: palette.teal,
  },
  deltaPillTextNegative: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: palette.red,
  },
  deltaPillTextNeutral: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: palette.muted,
  },
  insightGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginLeft: -5,
    marginRight: -5,
  },
  insightCell: {
    width: "50%",
    paddingLeft: 5,
    paddingRight: 5,
    marginBottom: 6,
  },
  insightCard: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    padding: 10,
    minHeight: 72,
    backgroundColor: "#ffffff",
  },
  insightTitle: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: palette.ink,
    marginBottom: 4,
  },
  insightDescription: {
    fontSize: 7.8,
    lineHeight: 1.35,
    color: palette.muted,
  },
  table: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: palette.surface,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  tableHeaderText: {
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    color: palette.muted,
    fontFamily: "Helvetica-Bold",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.lineSoft,
  },
  tableRowAlt: {
    backgroundColor: palette.surface,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tablePlatform: {
    width: "20%",
    paddingRight: 8,
  },
  tableMetric: {
    width: "13%",
    paddingRight: 8,
  },
  tablePosts: {
    width: "10%",
    paddingRight: 8,
  },
  tableEngagements: {
    width: "14%",
    paddingRight: 8,
  },
  tableRate: {
    width: "17%",
  },
  tableMain: {
    fontSize: 8.6,
    color: palette.ink,
    fontFamily: "Helvetica-Bold",
  },
  tableSub: {
    fontSize: 7.2,
    color: palette.muted,
    marginTop: 2,
  },
  platformName: {
    fontSize: 8.2,
    color: palette.ink,
    fontFamily: "Helvetica-Bold",
    textTransform: "capitalize",
  },
  postGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginLeft: -5,
    marginRight: -5,
  },
  postCell: {
    width: "50%",
    paddingLeft: 5,
    paddingRight: 5,
    marginBottom: 6,
  },
  postCard: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#ffffff",
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  postIndex: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: palette.blueSoft,
    color: palette.blue,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    paddingTop: 4,
  },
  postDate: {
    fontSize: 7.5,
    color: palette.subtle,
  },
  postCaption: {
    fontSize: 8.1,
    lineHeight: 1.35,
    color: palette.ink,
    marginBottom: 6,
  },
  postMetaRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    marginLeft: -4,
    marginRight: -4,
  },
  postMetaCell: {
    width: "33.3333%",
    paddingLeft: 4,
    paddingRight: 4,
    marginBottom: 6,
  },
  postMetaCard: {
    borderRadius: 10,
    backgroundColor: palette.surface,
    paddingHorizontal: 7,
    paddingVertical: 6,
  },
  postMetaLabel: {
    fontSize: 6.7,
    color: palette.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 1,
  },
  postMetaValue: {
    fontSize: 9.2,
    color: palette.ink,
    fontFamily: "Helvetica-Bold",
  },
  postMetaHint: {
    fontSize: 6.7,
    color: palette.subtle,
    marginTop: 1,
  },
  dnaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginLeft: -5,
    marginRight: -5,
  },
  dnaCell: {
    width: "50%",
    paddingLeft: 5,
    paddingRight: 5,
    marginBottom: 8,
  },
  dnaCard: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#ffffff",
    minHeight: 92,
  },
  dnaLabel: {
    fontSize: 10,
    color: palette.blue,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  dnaInsight: {
    fontSize: 8.4,
    lineHeight: 1.35,
    color: palette.ink,
    marginBottom: 4,
  },
  dnaDetail: {
    fontSize: 7.5,
    lineHeight: 1.35,
    color: palette.muted,
    marginBottom: 6,
  },
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  strengthTrack: {
    flexGrow: 1,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#dbeafe",
    overflow: "hidden",
    marginRight: 8,
  },
  strengthFill: {
    height: 5,
    borderRadius: 999,
    backgroundColor: palette.blue,
  },
  strengthText: {
    fontSize: 7.5,
    color: palette.muted,
    fontFamily: "Helvetica-Bold",
  },
  supportGrid: {
    flexDirection: "row",
    marginLeft: -5,
    marginRight: -5,
  },
  supportCell: {
    width: "50%",
    paddingLeft: 5,
    paddingRight: 5,
  },
  supportCard: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#ffffff",
    minHeight: 108,
  },
  supportTitle: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: palette.ink,
    marginBottom: 6,
  },
  supportSummary: {
    fontSize: 7.7,
    lineHeight: 1.35,
    color: palette.muted,
    marginBottom: 5,
  },
  supportItem: {
    fontSize: 7.7,
    lineHeight: 1.35,
    color: palette.ink,
    marginBottom: 3,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  tag: {
    fontSize: 7.5,
    color: palette.blue,
    backgroundColor: palette.blueSoft,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginLeft: 6,
    marginBottom: 4,
  },
  emptyState: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 14,
    backgroundColor: palette.surface,
    padding: 14,
  },
  emptyStateText: {
    fontSize: 8.5,
    color: palette.muted,
    lineHeight: 1.45,
  },
});

type KpiData = {
  label: string;
  value: number;
  delta: number;
  suffix?: string;
};

type PlatformSummary = {
  platform: string;
  totals: {
    followers: number;
    views: number;
    reach: number;
    engagements: number;
    posts_count: number;
  };
  delta: {
    followers: number;
    views: number;
    reach: number;
    engagements: number;
    posts_count: number;
  };
};

type PostSummary = {
  caption: string;
  date: string;
  visibility: {
    label: "Impressions" | "Vues" | "Portée";
    value: number;
  };
  engagements: number;
};

type ShootSummary = {
  date: string;
  location: string;
};

type DocumentSummary = {
  name: string;
  tag: string;
};

type ContentDnaPattern = {
  label: string;
  insight: string;
  detail: string;
  strength: number;
};

export type PdfDocumentProps = {
  tenantName: string;
  rangeLabel: string;
  prevRangeLabel: string;
  generatedAt: string;
  kpis: KpiData[];
  platforms: PlatformSummary[];
  posts: PostSummary[];
  shootDays: number;
  shoots: ShootSummary[];
  documents: DocumentSummary[];
  score?: {
    global: number;
    grade: string;
    subScores: Array<{ label: string; value: number }>;
    summary: string;
  };
  keyTakeaways?: string[];
  executiveSummary?: string;
  insights?: Array<{ title: string; description: string }>;
  contentDna?: ContentDnaPattern[];
  watermark?: string;
};

function sanitizeText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u00A0\u202F]/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/[…]/g, "...")
    .replace(/[•·]/g, "-")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7EÀ-ÖØ-öø-ÿŒœ€]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
    .format(value)
    .replace(/[\u00A0\u202F]/g, " ");
}

function formatMetricValue(value: number, suffix?: string): string {
  if (suffix === "%") {
    const digits = Number.isInteger(value) ? 0 : 1;
    return `${formatNumber(value, digits)}%`;
  }
  return formatNumber(value);
}

function formatDelta(delta: number): string {
  if (!Number.isFinite(delta) || delta === 0) {
    return "0%";
  }
  const digits = Math.abs(delta) < 10 && !Number.isInteger(delta) ? 1 : 0;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatNumber(delta, digits)}%`;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function computeEngagementRate(engagements: number, views: number, reach: number): string {
  if (views > 0) {
    return `${formatNumber((engagements / views) * 100, 1)}%`;
  }
  if (reach > 0) {
    return `${formatNumber((engagements / reach) * 100, 1)}%`;
  }
  return "-";
}

function DeltaPill({ delta }: { delta: number }) {
  const containerStyle =
    delta > 0
      ? styles.deltaPillPositive
      : delta < 0
        ? styles.deltaPillNegative
        : styles.deltaPillNeutral;
  const textStyle =
    delta > 0
      ? styles.deltaPillTextPositive
      : delta < 0
        ? styles.deltaPillTextNegative
        : styles.deltaPillTextNeutral;

  return (
    <View style={[styles.deltaPill, containerStyle]}>
      <Text style={textStyle}>{formatDelta(delta)}</Text>
    </View>
  );
}

function PageChrome(props: {
  tenantName: string;
  rangeLabel: string;
  generatedAt: string;
  watermark?: string;
}) {
  const safeTenantName = sanitizeText(props.tenantName) || "Client";
  const safeRangeLabel = sanitizeText(props.rangeLabel);
  const safeGeneratedAt = sanitizeText(props.generatedAt);
  const safeWatermark = props.watermark ? sanitizeText(props.watermark) : undefined;

  return (
    <>
      {safeWatermark ? (
        <Text style={styles.watermark} fixed>
          {safeWatermark}
        </Text>
      ) : null}
      <View style={styles.header} fixed>
        <View>
          <Text style={styles.headerBrand}>JumpStart Studio</Text>
          <Text style={styles.headerTenant}>{safeTenantName}</Text>
        </View>
        <View>
          <Text style={styles.headerMeta}>Période: {safeRangeLabel}</Text>
          <Text style={styles.headerMeta}>Généré le {safeGeneratedAt}</Text>
        </View>
      </View>
      <View style={styles.footer} fixed>
        <Text style={styles.footerNote}>
          Rapport social premium. Les variations comparent la période sélectionnée à la période
          précédente équivalente.
        </Text>
        <Text
          style={styles.footerPage}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber}/${totalPages}`}
        />
      </View>
    </>
  );
}

function MetricCard({ kpi }: { kpi: KpiData }) {
  return (
    <View style={styles.metricCell} wrap={false}>
      <View style={styles.metricCard}>
        <Text style={styles.metricLabel}>{sanitizeText(kpi.label)}</Text>
        <View style={styles.metricValueRow}>
          <Text style={styles.metricValue}>{formatMetricValue(kpi.value, kpi.suffix)}</Text>
          <DeltaPill delta={kpi.delta} />
        </View>
      </View>
    </View>
  );
}

function ScorePanel({
  score,
  executiveSummary,
}: {
  score?: PdfDocumentProps["score"];
  executiveSummary?: string;
}) {
  if (!score) {
    return (
      <View style={styles.scorePanel} wrap={false}>
      <Text style={styles.panelEyebrow}>Synthèse</Text>
      <Text style={styles.scoreSummary}>
        {truncateText(
          sanitizeText(
            executiveSummary ??
              "Le rapport rassemble la performance sociale, les contenus les plus visibles et les signaux éditoriaux utiles pour piloter la période."
          ),
          170
        )}
      </Text>
    </View>
  );
}

  return (
    <View style={styles.scorePanel} wrap={false}>
      <Text style={styles.panelEyebrow}>JumpStart Score</Text>
      <Text style={styles.scoreValue}>{formatNumber(score.global)}</Text>
      <Text style={styles.scoreGrade}>{sanitizeText(score.grade)}</Text>
      <Text style={styles.scoreSummary}>
        {truncateText(sanitizeText(executiveSummary ?? score.summary), 170)}
      </Text>
      <View style={{ marginTop: 12 }}>
        {score.subScores.map((subScore, index) => {
          const safeLabel = sanitizeText(subScore.label);
          const clamped = Math.max(0, Math.min(100, subScore.value));
          return (
            <View key={`${safeLabel}-${index}`} style={{ marginBottom: 7 }}>
              <View style={styles.subScoreRow}>
                <Text style={styles.subScoreLabel}>{safeLabel}</Text>
                <Text style={styles.subScoreValue}>{formatNumber(clamped)}/100</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${clamped}%` }]} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function TakeawaysPanel({ keyTakeaways }: { keyTakeaways?: string[] }) {
  const takeaways =
    keyTakeaways
      ?.map((item) => truncateText(sanitizeText(item), 102))
      .filter(Boolean)
      .slice(0, 4) ?? [];

  return (
    <View style={styles.takeawayCard} wrap={false}>
      <Text style={styles.panelEyebrow}>À retenir</Text>
      {takeaways.length > 0 ? (
        takeaways.map((takeaway, index) => (
          <View key={`${takeaway}-${index}`} style={styles.takeawayItem}>
            <Text style={styles.takeawayBullet}>{index + 1}</Text>
            <Text style={styles.takeawayText}>{takeaway}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.takeawayText}>
          Aucun point clé supplémentaire n'a été généré pour cette période.
        </Text>
      )}
    </View>
  );
}

function InsightCard({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.insightCell} wrap={false}>
      <View style={styles.insightCard}>
        <Text style={styles.insightTitle}>{sanitizeText(title)}</Text>
        <Text style={styles.insightDescription}>
          {truncateText(sanitizeText(description), 150)}
        </Text>
      </View>
    </View>
  );
}

function PlatformTable({ platforms }: { platforms: PlatformSummary[] }) {
  if (platforms.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>
          Aucune donnée de plateforme n'est disponible sur la période sélectionnée.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderText, styles.tablePlatform]}>Plateforme</Text>
        <Text style={[styles.tableHeaderText, styles.tableMetric]}>Abonnés</Text>
        <Text style={[styles.tableHeaderText, styles.tablePosts]}>Posts</Text>
        <Text style={[styles.tableHeaderText, styles.tableEngagements]}>Engagements</Text>
        <Text style={[styles.tableHeaderText, styles.tableMetric]}>Portée</Text>
        <Text style={[styles.tableHeaderText, styles.tableMetric]}>Vues</Text>
        <Text style={[styles.tableHeaderText, styles.tableRate]}>Taux eng.</Text>
      </View>
      {platforms.map((platform, index) => {
        const rate = computeEngagementRate(
          platform.totals.engagements,
          platform.totals.views,
          platform.totals.reach
        );
        const rowStyles =
          index === platforms.length - 1
            ? index % 2 === 1
              ? [styles.tableRow, styles.tableRowAlt, styles.tableRowLast]
              : [styles.tableRow, styles.tableRowLast]
            : index % 2 === 1
              ? [styles.tableRow, styles.tableRowAlt]
              : [styles.tableRow];
        return (
          <View
            key={`${platform.platform}-${index}`}
            style={rowStyles}
            wrap={false}
          >
            <View style={styles.tablePlatform}>
              <Text style={styles.platformName}>{sanitizeText(platform.platform)}</Text>
            </View>
            <View style={styles.tableMetric}>
              <Text style={styles.tableMain}>{formatNumber(platform.totals.followers)}</Text>
              <Text style={styles.tableSub}>{formatDelta(platform.delta.followers)}</Text>
            </View>
            <View style={styles.tablePosts}>
              <Text style={styles.tableMain}>{formatNumber(platform.totals.posts_count)}</Text>
              <Text style={styles.tableSub}>{formatDelta(platform.delta.posts_count)}</Text>
            </View>
            <View style={styles.tableEngagements}>
              <Text style={styles.tableMain}>{formatNumber(platform.totals.engagements)}</Text>
              <Text style={styles.tableSub}>{formatDelta(platform.delta.engagements)}</Text>
            </View>
            <View style={styles.tableMetric}>
              <Text style={styles.tableMain}>{formatNumber(platform.totals.reach)}</Text>
              <Text style={styles.tableSub}>{formatDelta(platform.delta.reach)}</Text>
            </View>
            <View style={styles.tableMetric}>
              <Text style={styles.tableMain}>{formatNumber(platform.totals.views)}</Text>
              <Text style={styles.tableSub}>{formatDelta(platform.delta.views)}</Text>
            </View>
            <View style={styles.tableRate}>
              <Text style={styles.tableMain}>{rate}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function PostCard({ post, index }: { post: PostSummary; index: number }) {
  const safeCaption = sanitizeText(post.caption || "Sans titre");
  const visibilityValue = post.visibility?.value ?? 0;
  const visibilityLabel = sanitizeText(post.visibility?.label ?? "Visibilité");
  const engagementRate =
    visibilityValue > 0 ? `${formatNumber((post.engagements / visibilityValue) * 100, 1)}%` : "-";

  return (
    <View style={styles.postCard} wrap={false}>
      <View style={styles.postHeader}>
        <Text style={styles.postIndex}>{String(index + 1).padStart(2, "0")}</Text>
        <Text style={styles.postDate}>{sanitizeText(post.date)}</Text>
      </View>
      <Text style={styles.postCaption}>{truncateText(safeCaption, 145)}</Text>
      <View style={styles.postMetaRow}>
        <View style={styles.postMetaCell}>
          <View style={styles.postMetaCard}>
            <Text style={styles.postMetaLabel}>Visibilité</Text>
            <Text style={styles.postMetaValue}>{formatNumber(visibilityValue)}</Text>
            <Text style={styles.postMetaHint}>{visibilityLabel}</Text>
          </View>
        </View>
        <View style={styles.postMetaCell}>
          <View style={styles.postMetaCard}>
            <Text style={styles.postMetaLabel}>Engagements</Text>
            <Text style={styles.postMetaValue}>{formatNumber(post.engagements)}</Text>
          </View>
        </View>
        <View style={styles.postMetaCell}>
          <View style={styles.postMetaCard}>
            <Text style={styles.postMetaLabel}>Taux eng.</Text>
            <Text style={styles.postMetaValue}>{engagementRate}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function DnaCard({ pattern }: { pattern: ContentDnaPattern }) {
  const clampedStrength = Math.max(0, Math.min(100, pattern.strength));

  return (
    <View style={styles.dnaCell} wrap={false}>
      <View style={styles.dnaCard}>
        <Text style={styles.dnaLabel}>{sanitizeText(pattern.label)}</Text>
        <Text style={styles.dnaInsight}>{truncateText(sanitizeText(pattern.insight), 96)}</Text>
        <Text style={styles.dnaDetail}>{truncateText(sanitizeText(pattern.detail), 130)}</Text>
        <View style={styles.strengthRow}>
          <View style={styles.strengthTrack}>
            <View style={[styles.strengthFill, { width: `${clampedStrength}%` }]} />
          </View>
          <Text style={styles.strengthText}>{formatNumber(clampedStrength)}%</Text>
        </View>
      </View>
    </View>
  );
}

function CollaborationPanel(props: {
  shootDays: number;
  shoots: ShootSummary[];
  documents: DocumentSummary[];
}) {
  const shoots = props.shoots.map((shoot) => ({
    date: sanitizeText(shoot.date),
    location: sanitizeText(shoot.location || "Lieu à définir"),
  }));
  const documents = props.documents.map((document) => ({
    name: sanitizeText(document.name),
    tag: sanitizeText(document.tag),
  }));

  return (
    <View style={styles.supportGrid}>
      <View style={styles.supportCell} wrap={false}>
        <View style={styles.supportCard}>
          <Text style={styles.supportTitle}>Production & shootings</Text>
          <Text style={styles.supportSummary}>
            Jours restants avant le prochain jalon de production: {formatNumber(props.shootDays)}
          </Text>
          {shoots.length > 0 ? (
            shoots.map((shoot, index) => (
              <Text key={`${shoot.date}-${index}`} style={styles.supportItem}>
                - {shoot.date} - {shoot.location}
              </Text>
            ))
          ) : (
            <Text style={styles.supportItem}>- Aucun shooting planifié</Text>
          )}
        </View>
      </View>
      <View style={styles.supportCell} wrap={false}>
        <View style={styles.supportCard}>
          <Text style={styles.supportTitle}>Documents & ressources</Text>
          <Text style={styles.supportSummary}>
            Derniers documents partagés utiles au pilotage éditorial et à la production.
          </Text>
          {documents.length > 0 ? (
            documents.map((document, index) => (
              <View key={`${document.name}-${index}`} style={styles.tagRow}>
                <Text style={styles.supportItem}>- {document.name}</Text>
                {document.tag ? <Text style={styles.tag}>{document.tag}</Text> : null}
              </View>
            ))
          ) : (
            <Text style={styles.supportItem}>- Aucun document partagé</Text>
          )}
        </View>
      </View>
    </View>
  );
}

export function PdfDocument(props: PdfDocumentProps) {
  const safeTenantName = sanitizeText(props.tenantName) || "Client";
  const safeRangeLabel = sanitizeText(props.rangeLabel);
  const safePrevRangeLabel = sanitizeText(props.prevRangeLabel);
  const safeGeneratedAt = sanitizeText(props.generatedAt);
  const safeExecutiveSummary = sanitizeText(
    props.executiveSummary ??
      "Vue synthétique de la performance sociale, des contenus les plus visibles et des leviers de progression immédiats."
  );
  const visibleInsights = props.insights?.slice(0, 4) ?? [];
  const heroFacts = [
    { label: "Période analysée", value: safeRangeLabel },
    { label: "Comparaison", value: safePrevRangeLabel },
    { label: "Canaux couverts", value: formatNumber(props.platforms.length) },
    {
      label: "Contenus en avant",
      value: formatNumber(props.posts.length),
    },
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <PageChrome
          tenantName={safeTenantName}
          rangeLabel={safeRangeLabel}
          generatedAt={safeGeneratedAt}
          watermark={props.watermark}
        />

        <View style={styles.hero} wrap={false}>
          <Text style={styles.heroEyebrow}>Rapport premium - performance sociale</Text>
          <Text style={styles.heroTitle}>{safeTenantName}</Text>
          <Text style={styles.heroSubtitle}>{truncateText(safeExecutiveSummary, 190)}</Text>
          <View style={styles.heroFactsRow}>
            {heroFacts.map((fact) => (
              <View key={fact.label} style={styles.heroFactCell}>
                <View style={styles.heroFact}>
                  <Text style={styles.heroFactLabel}>{fact.label}</Text>
                  <Text style={styles.heroFactValue}>{fact.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.colLeft}>
            <ScorePanel
              score={props.score}
              executiveSummary={props.executiveSummary}
            />
          </View>
          <View style={styles.colRight}>
            <TakeawaysPanel keyTakeaways={props.keyTakeaways} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Performance</Text>
          <Text style={styles.sectionTitle}>Indicateurs clés</Text>
          <Text style={styles.sectionLead}>
            Lecture rapide des métriques majeures de la période, avec variation versus la période
            précédente.
          </Text>
          <View style={styles.metricGrid}>
            {props.kpis.map((kpi, index) => (
              <MetricCard key={`${kpi.label}-${index}`} kpi={kpi} />
            ))}
          </View>
        </View>

      </Page>

      <Page size="A4" style={styles.page} wrap>
        <PageChrome
          tenantName={safeTenantName}
          rangeLabel={safeRangeLabel}
          generatedAt={safeGeneratedAt}
          watermark={props.watermark}
        />

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Lecture stratégique</Text>
          <Text style={styles.sectionTitle}>Angles d'analyse prioritaires</Text>
          <Text style={styles.sectionLead}>
            Les signaux suivants synthétisent les mouvements les plus importants observés sur la
            période.
          </Text>
          <View style={styles.insightGrid}>
            {visibleInsights.length > 0 ? (
              visibleInsights.map((insight, index) => (
                <InsightCard
                  key={`${insight.title}-${index}`}
                  title={insight.title}
                  description={insight.description}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  Aucun insight supplémentaire n'est disponible pour cette période.
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Canaux</Text>
          <Text style={styles.sectionTitle}>Performance par plateforme</Text>
          <Text style={styles.sectionLead}>
            Détail des volumes, de la visibilité et du rendement par canal sur la période exportée.
          </Text>
          <PlatformTable platforms={props.platforms} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Contenus</Text>
          <Text style={styles.sectionTitle}>Contenus les plus performants</Text>
          <Text style={styles.sectionLead}>
            Sélection des contenus les plus solides de la période, ordonnés par performance
            globale.
          </Text>
          {props.posts.length > 0 ? (
            <View style={styles.postGrid}>
              {props.posts.map((post, index) => (
                <View key={`${post.date}-${index}`} style={styles.postCell} wrap={false}>
                  <PostCard post={post} index={index} />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                Aucun contenu n'est disponible sur cette période.
              </Text>
            </View>
          )}
        </View>

        {props.contentDna && props.contentDna.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>Création</Text>
            <Text style={styles.sectionTitle}>ADN de contenu</Text>
            <Text style={styles.sectionLead}>
              Synthèse des patterns éditoriaux qui surperforment sur la période analysée.
            </Text>
            <View style={styles.dnaGrid}>
              {props.contentDna.map((pattern, index) => (
                <DnaCard key={`${pattern.label}-${index}`} pattern={pattern} />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Pilotage</Text>
          <Text style={styles.sectionTitle}>Collaboration & production</Text>
          <Text style={styles.sectionLead}>
            Éléments opérationnels utiles pour garder une lecture claire du contexte de production.
          </Text>
          <CollaborationPanel
            shootDays={props.shootDays}
            shoots={props.shoots}
            documents={props.documents}
          />
        </View>
      </Page>
    </Document>
  );
}
