import React from "react";
import { Document, Image, Link, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { DashboardDataQuality } from "./dashboard-data-quality";
import type { DashboardOpportunity } from "./dashboard-opportunities";
import type { PlatformDiagnosis, PlatformDiagnosisItem } from "./platform-diagnosis";
import type { ContentPortfolio } from "./content-portfolio";
import type { PlatformMix } from "./platform-mix";
import { buildProductionReadiness } from "./production-readiness";

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
  violet: "#6d4dff",
  violetSoft: "#ede9fe",
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
    backgroundColor: "#15122e",
    borderWidth: 1,
    borderColor: "#312e81",
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },
  heroAccent: {
    width: 118,
    height: 4,
    borderRadius: 999,
    backgroundColor: palette.teal,
    marginBottom: 12,
  },
  heroEyebrow: {
    fontSize: 8,
    color: "#a7f3d0",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 7,
  },
  heroTitle: {
    fontSize: 27,
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
    backgroundColor: "#211c4f",
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: "#3d367c",
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
    borderRadius: 14,
    padding: 16,
    backgroundColor: "#ffffff",
  },
  scorePanel: {
    borderWidth: 1,
    borderColor: "#c7d2fe",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#f8f7ff",
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
    borderColor: "#ccfbf1",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#f0fdfa",
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
    backgroundColor: palette.tealSoft,
    color: palette.teal,
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
  qualityPanel: {
    borderWidth: 1,
    borderColor: "#bfdbff",
    borderRadius: 14,
    padding: 12,
    backgroundColor: palette.surfaceStrong,
    minHeight: 132,
  },
  opportunityPanel: {
    borderWidth: 1,
    borderColor: "#c7d2fe",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#f8f7ff",
    marginTop: 12,
  },
  opportunityGrid: {
    flexDirection: "row",
    marginLeft: -4,
    marginRight: -4,
  },
  opportunityCell: {
    width: "33.3333%",
    paddingLeft: 4,
    paddingRight: 4,
  },
  opportunityCard: {
    borderWidth: 1,
    borderColor: "#ddd6fe",
    borderRadius: 12,
    padding: 9,
    backgroundColor: "#ffffff",
    minHeight: 92,
  },
  opportunityTitle: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: palette.ink,
    marginBottom: 4,
  },
  opportunityAutomation: {
    fontSize: 7.1,
    lineHeight: 1.3,
    color: palette.muted,
    marginBottom: 5,
  },
  opportunityEvidence: {
    fontSize: 7,
    color: palette.violet,
    fontFamily: "Helvetica-Bold",
  },
  opportunityConfidence: {
    marginTop: 4,
    fontSize: 6.7,
    color: palette.teal,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  diagnosisPanel: {
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#f8fbff",
    marginTop: 10,
  },
  diagnosisGrid: {
    flexDirection: "row",
    marginLeft: -4,
    marginRight: -4,
  },
  diagnosisCell: {
    width: "33.3333%",
    paddingLeft: 4,
    paddingRight: 4,
  },
  diagnosisCard: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 12,
    padding: 9,
    backgroundColor: "#ffffff",
    minHeight: 70,
  },
  diagnosisLabel: {
    fontSize: 6.8,
    color: palette.blue,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 5,
  },
  diagnosisValue: {
    fontSize: 10.2,
    color: palette.ink,
    fontFamily: "Helvetica-Bold",
    marginBottom: 5,
  },
  diagnosisDetail: {
    fontSize: 7.2,
    lineHeight: 1.3,
    color: palette.muted,
  },
  contentPortfolioPanel: {
    borderWidth: 1,
    borderColor: "#ccfbf1",
    borderRadius: 14,
    padding: 10,
    backgroundColor: "#f0fdfa",
    marginBottom: 8,
  },
  contentPortfolioGrid: {
    flexDirection: "row",
    marginLeft: -4,
    marginRight: -4,
  },
  contentPortfolioCell: {
    width: "33.3333%",
    paddingLeft: 4,
    paddingRight: 4,
  },
  platformMixPanel: {
    borderWidth: 1,
    borderColor: "#bae6fd",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#f0f9ff",
    marginBottom: 10,
  },
  platformMixGrid: {
    flexDirection: "row",
    marginLeft: -4,
    marginRight: -4,
  },
  platformMixCell: {
    width: "25%",
    paddingLeft: 4,
    paddingRight: 4,
  },
  platformMixCard: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 12,
    padding: 9,
    backgroundColor: "#ffffff",
    minHeight: 105,
  },
  platformMixRole: {
    fontSize: 6.7,
    color: palette.blue,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  platformMixName: {
    fontSize: 10.2,
    color: palette.ink,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    textTransform: "capitalize",
  },
  platformMixMetricRow: {
    marginBottom: 5,
  },
  platformMixMetricLabel: {
    fontSize: 6.8,
    color: palette.muted,
    marginBottom: 2,
  },
  platformMixTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: "#dbeafe",
    overflow: "hidden",
  },
  platformMixFill: {
    height: 5,
    borderRadius: 999,
    backgroundColor: palette.blue,
  },
  platformMixSummary: {
    fontSize: 6.8,
    lineHeight: 1.25,
    color: palette.muted,
    marginTop: 3,
  },
  qualityScore: {
    fontSize: 22,
    color: palette.blue,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  qualitySummary: {
    fontSize: 7.5,
    lineHeight: 1.3,
    color: palette.ink,
    marginBottom: 7,
  },
  qualityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#d6e4ff",
    paddingTop: 5,
    marginTop: 5,
  },
  qualityPlatform: {
    fontSize: 7.6,
    color: palette.ink,
    fontFamily: "Helvetica-Bold",
    textTransform: "capitalize",
  },
  qualityStatus: {
    fontSize: 7.2,
    color: palette.muted,
  },
  section: {
    marginTop: 12,
  },
  sectionEyebrow: {
    fontSize: 7,
    color: palette.blue,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
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
  insightPrimaryCell: {
    width: "100%",
    paddingLeft: 5,
    paddingRight: 5,
    marginBottom: 8,
  },
  insightCard: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    padding: 10,
    minHeight: 72,
    backgroundColor: "#ffffff",
  },
  insightPrimaryCard: {
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 14,
    padding: 12,
    minHeight: 88,
    backgroundColor: "#f8fbff",
  },
  insightKicker: {
    fontSize: 6.8,
    color: palette.blue,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 5,
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
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  postPreview: {
    height: 92,
    backgroundColor: palette.surfaceStrong,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    alignItems: "center",
    justifyContent: "center",
  },
  postPreviewImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  postPreviewFallback: {
    fontSize: 16,
    color: palette.blue,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  postBody: {
    padding: 10,
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  postHeaderMeta: {
    alignItems: "flex-end",
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
  postPlatformTag: {
    marginTop: 3,
    fontSize: 6.9,
    color: palette.blue,
    backgroundColor: palette.blueSoft,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    textTransform: "uppercase",
    letterSpacing: 0.8,
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
    borderColor: "#ddd6fe",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#fbfaff",
    minHeight: 96,
  },
  dnaLabel: {
    fontSize: 7,
    color: palette.violet,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  dnaInsight: {
    fontSize: 9,
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
    backgroundColor: "#ede9fe",
    overflow: "hidden",
    marginRight: 8,
  },
  strengthFill: {
    height: 5,
    borderRadius: 999,
    backgroundColor: palette.violet,
  },
  strengthText: {
    fontSize: 7.5,
    color: palette.muted,
    fontFamily: "Helvetica-Bold",
  },
  productionHero: {
    borderWidth: 1,
    borderColor: "#ccfbf1",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#f0fdfa",
    marginBottom: 10,
  },
  productionGrid: {
    flexDirection: "row",
    marginLeft: -4,
    marginRight: -4,
  },
  productionCell: {
    width: "33.3333%",
    paddingLeft: 4,
    paddingRight: 4,
  },
  productionMetric: {
    borderWidth: 1,
    borderColor: "#ccfbf1",
    borderRadius: 12,
    padding: 9,
    backgroundColor: "#ffffff",
    minHeight: 66,
  },
  productionLabel: {
    fontSize: 6.8,
    color: palette.teal,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.9,
    marginBottom: 5,
  },
  productionValue: {
    fontSize: 12,
    color: palette.ink,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  productionSummary: {
    fontSize: 7.4,
    lineHeight: 1.3,
    color: palette.muted,
    marginBottom: 8,
  },
  productionResources: {
    borderTopWidth: 1,
    borderTopColor: "#ccfbf1",
    marginTop: 9,
    paddingTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  productionResourceLabel: {
    fontSize: 7,
    color: palette.teal,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.9,
    marginRight: 6,
    marginBottom: 4,
  },
  productionTag: {
    fontSize: 7.5,
    color: palette.teal,
    backgroundColor: palette.tealSoft,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginRight: 5,
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
  platform?: string;
  platformLabel?: string;
  thumbnailUrl?: string | null;
  url?: string | null;
  visibility: {
    label: "Impressions" | "Vues" | "Portée";
    value: number;
  };
  engagements: number;
  engagementRate?: number | null;
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
  opportunities?: DashboardOpportunity[];
  platformDiagnosis?: PlatformDiagnosis;
  contentPortfolio?: ContentPortfolio;
  platformMix?: PlatformMix;
  dataQuality?: DashboardDataQuality;
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
  dataQuality,
}: {
  score?: PdfDocumentProps["score"];
  executiveSummary?: string;
  dataQuality?: DashboardDataQuality;
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

  const scoreCaveat = dataQuality && dataQuality.overallCoverage < 80
    ? dataQuality.overallCoverage < 50
      ? "Score à interpréter avec prudence: certaines données de portée, vues ou engagements sont incomplètes."
      : "Score fiable pour la tendance, avec quelques points de données à contrôler."
    : null;

  return (
    <View style={styles.scorePanel} wrap={false}>
      <Text style={styles.panelEyebrow}>JumpStart Score</Text>
      <Text style={styles.scoreValue}>{formatNumber(score.global)}</Text>
      <Text style={styles.scoreGrade}>{sanitizeText(score.grade)}</Text>
      <Text style={styles.scoreSummary}>
        {truncateText(sanitizeText(executiveSummary ?? score.summary), 170)}
      </Text>
      {scoreCaveat ? (
        <Text style={styles.scoreSummary}>
          {truncateText(sanitizeText(scoreCaveat), 140)}
        </Text>
      ) : null}
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

function DataQualityPanel({ dataQuality }: { dataQuality?: DashboardDataQuality }) {
  if (!dataQuality) {
    return null;
  }

  const platformRows = dataQuality.platformQuality.slice(0, 4);
  const staleLabel = dataQuality.staleSync
    ? "Synchronisation à rafraîchir"
    : "Synchronisation récente";

  return (
    <View style={styles.qualityPanel} wrap={false}>
      <Text style={styles.panelEyebrow}>Qualité des données</Text>
      <Text style={styles.qualityScore}>{formatNumber(dataQuality.overallCoverage)}%</Text>
      <Text style={styles.qualitySummary}>
        {sanitizeText(staleLabel)} - couverture moyenne sur {formatNumber(dataQuality.expectedDays)} jours.
      </Text>
      {platformRows.map((item) => (
        <View key={item.platform} style={styles.qualityRow}>
          <Text style={styles.qualityPlatform}>{sanitizeText(item.platform)}</Text>
          <Text style={styles.qualityStatus}>
            {formatNumber(item.coverage)}% - {sanitizeText(item.status)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function OpportunitiesPanel({ opportunities }: { opportunities?: DashboardOpportunity[] }) {
  const visibleOpportunities = (opportunities ?? []).slice(0, 3);
  if (!visibleOpportunities.length) return null;

  return (
    <View style={styles.opportunityPanel} wrap={false}>
      <Text style={styles.panelEyebrow}>Opportunités prioritaires</Text>
      <Text style={styles.sectionLead}>
        Les leviers ci-dessous sont filtrés pour ne retenir que les signaux exploitables par le client.
      </Text>
      <View style={styles.opportunityGrid}>
        {visibleOpportunities.map((opportunity) => (
          <View key={opportunity.id} style={styles.opportunityCell}>
            <View style={styles.opportunityCard}>
              <Text style={styles.opportunityTitle}>
                {truncateText(sanitizeText(opportunity.title), 54)}
              </Text>
              <Text style={styles.opportunityAutomation}>
                {truncateText(sanitizeText(opportunity.automation), 108)}
              </Text>
              <Text style={styles.opportunityEvidence}>
                {truncateText(sanitizeText(opportunity.evidence), 48)}
              </Text>
              <Text style={styles.opportunityConfidence}>
                Confiance {sanitizeText(opportunity.confidence)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function PlatformDiagnosisTile({ item }: { item: PlatformDiagnosisItem }) {
  return (
    <View style={styles.diagnosisCell} wrap={false}>
      <View style={styles.diagnosisCard}>
        <Text style={styles.diagnosisLabel}>{sanitizeText(item.label)}</Text>
        <Text style={styles.diagnosisValue}>{sanitizeText(item.value)}</Text>
        <Text style={styles.diagnosisDetail}>{truncateText(sanitizeText(item.detail), 116)}</Text>
      </View>
    </View>
  );
}

function PlatformDiagnosisPanel({ diagnosis }: { diagnosis?: PlatformDiagnosis }) {
  const items = diagnosis ? [diagnosis.primary, diagnosis.watch, diagnosis.balance].filter(Boolean) as PlatformDiagnosisItem[] : [];
  if (items.length === 0) return null;

  return (
    <View style={styles.diagnosisPanel} wrap={false}>
      <Text style={styles.panelEyebrow}>Diagnostic canaux</Text>
      <Text style={styles.sectionLead}>
        Lecture rapide du canal moteur, du point à surveiller et de la concentration du mix.
      </Text>
      <View style={styles.diagnosisGrid}>
        {items.map((item) => (
          <PlatformDiagnosisTile key={`${item.label}-${item.platform}`} item={item} />
        ))}
      </View>
    </View>
  );
}

function ContentPortfolioPanel({ portfolio }: { portfolio?: ContentPortfolio }) {
  if (!portfolio || portfolio.postsAnalyzed === 0) return null;

  return (
    <View style={styles.contentPortfolioPanel} wrap={false}>
      <Text style={styles.panelEyebrow}>Portefeuille créatif</Text>
      <View style={styles.contentPortfolioGrid}>
        <View style={styles.contentPortfolioCell}>
          <Text style={styles.diagnosisLabel}>Format dominant</Text>
          <Text style={styles.diagnosisValue}>{sanitizeText(portfolio.dominantFormat ?? "-")}</Text>
        </View>
        <View style={styles.contentPortfolioCell}>
          <Text style={styles.diagnosisLabel}>Canal contributeur</Text>
          <Text style={styles.diagnosisValue}>{sanitizeText(portfolio.topPlatform ?? "-")}</Text>
        </View>
        <View style={styles.contentPortfolioCell}>
          <Text style={styles.diagnosisLabel}>Rendement moyen</Text>
          <Text style={styles.diagnosisValue}>
            {portfolio.averageEngagementRate != null ? `${formatNumber(portfolio.averageEngagementRate, 1)}%` : "-"} - {sanitizeText(portfolio.qualityLabel)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function PlatformMixPanel({ mix }: { mix?: PlatformMix }) {
  const visibleItems = (mix?.items ?? []).slice(0, 4);
  if (visibleItems.length === 0) return null;

  return (
    <View style={styles.platformMixPanel} wrap={false}>
      <Text style={styles.panelEyebrow}>Mix de canaux</Text>
      <Text style={styles.sectionLead}>
        Contribution de chaque canal à la visibilité et à l'engagement, avant le détail chiffré.
      </Text>
      <View style={styles.platformMixGrid}>
        {visibleItems.map((item) => (
          <View key={item.platform} style={styles.platformMixCell}>
            <View style={styles.platformMixCard}>
              <Text style={styles.platformMixRole}>{sanitizeText(item.role)}</Text>
              <Text style={styles.platformMixName}>{sanitizeText(item.platform)}</Text>
              <View style={styles.platformMixMetricRow}>
                <Text style={styles.platformMixMetricLabel}>
                  Visibilité {formatNumber(item.visibilityShare)}%
                </Text>
                <View style={styles.platformMixTrack}>
                  <View style={[styles.platformMixFill, { width: `${Math.min(100, item.visibilityShare)}%` }]} />
                </View>
              </View>
              <View style={styles.platformMixMetricRow}>
                <Text style={styles.platformMixMetricLabel}>
                  Engagement {formatNumber(item.engagementShare)}%
                </Text>
                <View style={styles.platformMixTrack}>
                  <View
                    style={[
                      styles.platformMixFill,
                      {
                        width: `${Math.min(100, item.engagementShare)}%`,
                        backgroundColor: palette.teal,
                      },
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.platformMixSummary}>
                {truncateText(sanitizeText(item.summary), 76)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function InsightCard({
  title,
  description,
  index,
  primary = false,
}: {
  title: string;
  description: string;
  index: number;
  primary?: boolean;
}) {
  return (
    <View style={primary ? styles.insightPrimaryCell : styles.insightCell} wrap={false}>
      <View style={primary ? styles.insightPrimaryCard : styles.insightCard}>
        <Text style={styles.insightKicker}>
          {primary ? "Signal principal" : `Angle ${index + 1}`}
        </Text>
        <Text style={styles.insightTitle}>{sanitizeText(title)}</Text>
        <Text style={styles.insightDescription}>
          {truncateText(sanitizeText(description), primary ? 220 : 150)}
        </Text>
      </View>
    </View>
  );
}

function PostCard({ post, index }: { post: PostSummary; index: number }) {
  const safeCaption = sanitizeText(post.caption || "Sans titre");
  const visibilityValue = post.visibility?.value ?? 0;
  const visibilityLabel = sanitizeText(post.visibility?.label ?? "Visibilité");
  const engagementRate =
    post.engagementRate != null
      ? `${formatNumber(post.engagementRate, 1)}%`
      : visibilityValue > 0
        ? `${formatNumber((post.engagements / visibilityValue) * 100, 1)}%`
        : "-";
  const safePlatformLabel = sanitizeText(post.platformLabel ?? post.platform ?? "Réseau");

  const cardContent = (
    <View style={styles.postCard} wrap={false}>
        <View style={styles.postPreview}>
          {post.thumbnailUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={post.thumbnailUrl} style={styles.postPreviewImage} />
          ) : (
            <Text style={styles.postPreviewFallback}>{truncateText(safePlatformLabel, 16)}</Text>
          )}
      </View>
      <View style={styles.postBody}>
        <View style={styles.postHeader}>
          <Text style={styles.postIndex}>{String(index + 1).padStart(2, "0")}</Text>
          <View style={styles.postHeaderMeta}>
            <Text style={styles.postDate}>{sanitizeText(post.date)}</Text>
            <Text style={styles.postPlatformTag}>{safePlatformLabel}</Text>
          </View>
        </View>
        <Text style={styles.postCaption}>{truncateText(safeCaption, 145)}</Text>
        <View style={styles.postMetaRow}>
          <View style={styles.postMetaCell}>
            <View style={styles.postMetaCard}>
              <Text style={styles.postMetaLabel}>Visibilité</Text>
              <Text style={styles.postMetaValue}>
                {visibilityValue > 0 ? formatNumber(visibilityValue) : "-"}
              </Text>
              <Text style={styles.postMetaHint}>{visibilityValue > 0 ? visibilityLabel : "-"}</Text>
            </View>
          </View>
          <View style={styles.postMetaCell}>
            <View style={styles.postMetaCard}>
              <Text style={styles.postMetaLabel}>Engagements</Text>
              <Text style={styles.postMetaValue}>
                {post.engagements > 0 ? formatNumber(post.engagements) : "-"}
              </Text>
            </View>
          </View>
          <View style={styles.postMetaCell}>
            <View style={styles.postMetaCard}>
              <Text style={styles.postMetaLabel}>Taux eng.</Text>
              <Text style={styles.postMetaValue}>{post.engagements > 0 ? engagementRate : "-"}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  if (post.url) {
    return <Link src={post.url}>{cardContent}</Link>;
  }

  return cardContent;
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
  const readiness = buildProductionReadiness({
    shootDaysRemaining: props.shootDays,
    shoots: props.shoots.map((shoot) => ({
      shoot_date: shoot.date,
      location: shoot.location,
    })),
    documents: props.documents,
  });
  const featuredDocuments = readiness.featuredDocuments
    .map((document) => sanitizeText(document.name || document.tag))
    .filter(Boolean)
    .slice(0, 3);

  return (
    <View style={styles.productionHero} wrap={false}>
      <Text style={styles.panelEyebrow}>Continuité créative</Text>
      <Text style={styles.productionSummary}>
        {truncateText(sanitizeText(readiness.summary), 150)}
      </Text>
      <View style={styles.productionGrid}>
        <View style={styles.productionCell}>
          <View style={styles.productionMetric}>
            <Text style={styles.productionLabel}>Statut</Text>
            <Text style={styles.productionValue}>{sanitizeText(readiness.statusLabel)}</Text>
          </View>
        </View>
        <View style={styles.productionCell}>
          <View style={styles.productionMetric}>
            <Text style={styles.productionLabel}>Prochain jalon</Text>
            <Text style={styles.productionValue}>{sanitizeText(readiness.nextShootLabel)}</Text>
            <Text style={styles.diagnosisDetail}>{sanitizeText(readiness.nextShootLocation)}</Text>
          </View>
        </View>
        <View style={styles.productionCell}>
          <View style={styles.productionMetric}>
            <Text style={styles.productionLabel}>Ressources</Text>
            <Text style={styles.productionValue}>{formatNumber(readiness.documentCount)}</Text>
            <Text style={styles.diagnosisDetail}>documents partagés</Text>
          </View>
        </View>
      </View>
      {featuredDocuments.length > 0 ? (
        <View style={styles.productionResources}>
          <Text style={styles.productionResourceLabel}>Ressources clés</Text>
          {featuredDocuments.map((name, index) => (
            <Text key={`${name}-${index}`} style={styles.productionTag}>
              {truncateText(name, 26)}
            </Text>
          ))}
        </View>
      ) : null}
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
          <View style={styles.heroAccent} />
          <Text style={styles.heroEyebrow}>Rapport premium - JumpStart Intelligence</Text>
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
              dataQuality={props.dataQuality}
            />
          </View>
          <View style={styles.colRight}>
            <TakeawaysPanel keyTakeaways={props.keyTakeaways} />
          </View>
        </View>

        {props.dataQuality ? (
          <View style={styles.section} wrap={false}>
            <DataQualityPanel dataQuality={props.dataQuality} />
          </View>
        ) : null}

        <OpportunitiesPanel opportunities={props.opportunities} />
        <PlatformDiagnosisPanel diagnosis={props.platformDiagnosis} />

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
                  index={index}
                  primary={index === 0}
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
          <Text style={styles.sectionTitle}>Mix de canaux</Text>
          <Text style={styles.sectionLead}>
            Contribution de chaque canal à la visibilité, à l'engagement et au rendement éditorial.
          </Text>
          <PlatformMixPanel mix={props.platformMix} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Contenus</Text>
          <Text style={styles.sectionTitle}>Contenus les plus performants</Text>
          <Text style={styles.sectionLead}>
            Sélection des contenus les plus solides de la période, ordonnés par performance
            globale.
          </Text>
          <ContentPortfolioPanel portfolio={props.contentPortfolio} />
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
