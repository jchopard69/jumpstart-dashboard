import React from "react";
import { Document, Image, Link, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { DashboardDataQuality } from "./dashboard-data-quality";
import type { DashboardOpportunity } from "./dashboard-opportunities";
import type { PlatformDiagnosis, PlatformDiagnosisItem } from "./platform-diagnosis";
import type { ContentPortfolio } from "./content-portfolio";
import type { PlatformMix } from "./platform-mix";
import type { MomentHighlight } from "./moment-highlights";
import { buildProductionReadiness } from "./production-readiness";

const SLIDE = { width: 1440, height: 810 };
const BLUE = "#234dff";
const BLUE_DARK = "#111827";
const BLUE_SOFT = "#e9edff";
const CYAN = "#18b6d9";
const GOLD = "#ffbf3f";
const INK = "#111827";
const MUTED = "#667085";
const PAPER = "#f5f7fb";
const CARD = "#ffffff";
const MIX_BAR_WIDTH = 306;

const styles = StyleSheet.create({
  page: {
    width: SLIDE.width,
    height: SLIDE.height,
    backgroundColor: PAPER,
    color: INK,
    fontFamily: "Helvetica",
    position: "relative",
  },
  coverPage: {
    width: SLIDE.width,
    height: SLIDE.height,
    backgroundColor: BLUE_DARK,
    color: "#ffffff",
    fontFamily: "Helvetica",
    position: "relative",
  },
  coverTitle: {
    position: "absolute",
    left: 86,
    top: 178,
    width: 700,
    fontSize: 78,
    lineHeight: 0.98,
    fontFamily: "Helvetica-Bold",
  },
  coverKicker: {
    position: "absolute",
    left: 90,
    top: 118,
    fontSize: 18,
    letterSpacing: 2.6,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
    color: GOLD,
  },
  coverMeta: {
    position: "absolute",
    left: 90,
    top: 390,
    width: 620,
    fontSize: 22,
    lineHeight: 1.38,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  coverBrand: {
    position: "absolute",
    left: 90,
    bottom: 74,
    width: 250,
    color: "#ffffff",
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
  },
  coverClient: {
    position: "absolute",
    right: 90,
    bottom: 70,
    width: 380,
    paddingTop: 20,
    borderTopWidth: 3,
    borderTopColor: GOLD,
    fontSize: 24,
    lineHeight: 1.15,
    fontFamily: "Helvetica-Bold",
  },
  coverPeriodBadge: {
    position: "absolute",
    right: 90,
    top: 90,
    borderWidth: 2,
    borderColor: GOLD,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 12,
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
  },
  coverAccent: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 470,
    height: SLIDE.height,
    backgroundColor: BLUE,
  },
  coverPanel: {
    position: "absolute",
    right: 90,
    top: 208,
    width: 360,
    borderRadius: 34,
    padding: 30,
    backgroundColor: "#ffffff",
    color: INK,
  },
  coverPanelLabel: {
    fontSize: 14,
    color: MUTED,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
  },
  coverPanelValue: {
    marginTop: 12,
    fontSize: 52,
    lineHeight: 0.95,
    color: BLUE,
    fontFamily: "Helvetica-Bold",
  },
  coverPanelText: {
    marginTop: 16,
    fontSize: 18,
    lineHeight: 1.3,
    color: MUTED,
  },
  topBand: {
    height: 148,
    paddingTop: 38,
    paddingHorizontal: 78,
    backgroundColor: PAPER,
    color: INK,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  pageTitle: {
    fontSize: 48,
    lineHeight: 1,
    fontFamily: "Helvetica-Bold",
  },
  pageSubtitle: {
    marginTop: 12,
    fontSize: 19,
    color: MUTED,
    lineHeight: 1.2,
  },
  logoLight: {
    width: 132,
    height: 34,
    objectFit: "contain",
  },
  logoText: {
    color: BLUE,
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    marginTop: 4,
  },
  content: {
    paddingHorizontal: 78,
    paddingTop: 48,
  },
  footer: {
    position: "absolute",
    left: 78,
    right: 78,
    bottom: 18,
    color: MUTED,
    fontSize: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  pill: {
    backgroundColor: BLUE_DARK,
    color: "#ffffff",
    borderRadius: 22,
    paddingHorizontal: 34,
    paddingVertical: 13,
    alignSelf: "flex-start",
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  summaryText: {
    marginTop: 34,
    fontSize: 26,
    lineHeight: 1.34,
    color: "#3b3b3b",
  },
  summaryLayout: {
    marginTop: 34,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryMain: {
    width: "64%",
  },
  summaryAside: {
    width: "29%",
    paddingTop: 4,
  },
  summaryKpiCard: {
    borderRadius: 26,
    backgroundColor: BLUE_DARK,
    color: "#ffffff",
    paddingHorizontal: 30,
    paddingVertical: 24,
    marginBottom: 18,
  },
  summaryKpiLabel: {
    fontSize: 15,
    color: "#d9e7ff",
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
  },
  summaryKpiValue: {
    marginTop: 8,
    fontSize: 46,
    lineHeight: 1,
    fontFamily: "Helvetica-Bold",
  },
  summaryKpiHint: {
    marginTop: 8,
    fontSize: 16,
    color: "#eaf1ff",
  },
  insightStrip: {
    marginTop: 28,
    borderLeftWidth: 8,
    borderLeftColor: GOLD,
    paddingLeft: 24,
  },
  insightStripText: {
    fontSize: 22,
    lineHeight: 1.25,
    color: BLUE_DARK,
    fontFamily: "Helvetica-Bold",
  },
  bigMetricRow: {
    marginTop: 146,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  bigMetric: {
    width: "31%",
  },
  bigMetricValue: {
    fontSize: 88,
    lineHeight: 0.96,
    color: INK,
    fontFamily: "Helvetica-Bold",
  },
  bigMetricLabel: {
    marginTop: 14,
    fontSize: 31,
    lineHeight: 1.1,
    color: INK,
  },
  deltaText: {
    marginTop: 14,
    fontSize: 18,
    color: CYAN,
    fontFamily: "Helvetica-Bold",
  },
  platformGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: 16,
  },
  platformCard: {
    minHeight: 306,
    borderRadius: 36,
    backgroundColor: CARD,
    borderWidth: 2,
    borderColor: "#dce3f1",
    color: INK,
    paddingHorizontal: 44,
    paddingVertical: 34,
  },
  platformIcon: {
    fontSize: 58,
    color: CYAN,
    textAlign: "center",
    marginBottom: 12,
  },
  platformTitle: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    textTransform: "capitalize",
    color: INK,
    textAlign: "center",
    marginBottom: 14,
  },
  platformValue: {
    fontSize: 50,
    lineHeight: 1,
    color: INK,
    fontFamily: "Helvetica-Bold",
  },
  platformLabel: {
    marginTop: 8,
    marginBottom: 18,
    fontSize: 21,
    lineHeight: 1.15,
    color: MUTED,
  },
  progressWrap: {
    marginTop: 14,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    color: CYAN,
    fontSize: 16,
    marginBottom: 8,
  },
  progressTrack: {
    width: MIX_BAR_WIDTH,
    height: 36,
    borderRadius: 20,
    backgroundColor: BLUE_SOFT,
    overflow: "hidden",
  },
  progressFill: {
    height: 36,
    borderRadius: 20,
    backgroundColor: CYAN,
  },
  progressPercent: {
    position: "absolute",
    top: 8,
    right: 20,
    fontSize: 15,
    color: BLUE_DARK,
    fontFamily: "Helvetica-Bold",
  },
  progressCaption: {
    marginTop: 10,
    fontSize: 15,
    color: MUTED,
  },
  postGrid: {
    flexDirection: "row",
    gap: 24,
  },
  postCard: {
    width: "31.7%",
    borderRadius: 28,
    backgroundColor: CARD,
    overflow: "hidden",
    color: INK,
  },
  postImage: {
    height: 220,
    width: "100%",
    objectFit: "cover",
    backgroundColor: "#dbe7ff",
  },
  postFallback: {
    height: 220,
    backgroundColor: BLUE_SOFT,
    color: BLUE,
    alignItems: "center",
    justifyContent: "center",
    fontSize: 42,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  postBody: {
    padding: 24,
  },
  postRank: {
    fontSize: 15,
    color: BLUE,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  postCaption: {
    marginTop: 10,
    minHeight: 62,
    fontSize: 18,
    lineHeight: 1.18,
  },
  postNumbers: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  postNumberValue: {
    fontSize: 30,
    fontFamily: "Helvetica-Bold",
  },
  postNumberLabel: {
    marginTop: 4,
    fontSize: 13,
    color: MUTED,
    textTransform: "uppercase",
  },
  actionGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 24,
  },
  actionCard: {
    width: "31.7%",
    borderRadius: 32,
    borderWidth: 3,
    borderColor: BLUE,
    padding: 34,
    minHeight: 300,
  },
  actionCardFilled: {
    backgroundColor: BLUE_DARK,
    color: "#ffffff",
  },
  actionCardSoft: {
    backgroundColor: "#f6f8ff",
  },
  actionIndex: {
    width: 54,
    height: 54,
    borderRadius: 28,
    backgroundColor: BLUE,
    color: "#ffffff",
    fontSize: 27,
    paddingTop: 11,
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
  },
  actionIndexLight: {
    backgroundColor: "#ffffff",
    color: BLUE,
  },
  actionTitle: {
    marginTop: 24,
    fontSize: 28,
    lineHeight: 1.08,
    color: BLUE,
    fontFamily: "Helvetica-Bold",
  },
  actionTitleLight: {
    color: "#ffffff",
  },
  actionText: {
    marginTop: 16,
    fontSize: 19,
    lineHeight: 1.26,
  },
  actionTextLight: {
    color: "#edf4ff",
  },
  smallKpiRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 54,
  },
  smallKpi: {
    width: "23%",
    borderTopWidth: 6,
    borderTopColor: GOLD,
    paddingTop: 18,
  },
  smallKpiValue: {
    fontSize: 38,
    color: BLUE,
    fontFamily: "Helvetica-Bold",
  },
  smallKpiLabel: {
    marginTop: 8,
    fontSize: 17,
    color: MUTED,
  },
  watermark: {
    position: "absolute",
    left: 322,
    top: 334,
    fontSize: 96,
    color: "#ffffff",
    opacity: 0.14,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 8,
  },
  closingBand: {
    marginTop: 58,
    borderRadius: 34,
    backgroundColor: BLUE,
    color: "#ffffff",
    paddingHorizontal: 42,
    paddingVertical: 34,
  },
  closingTitle: {
    fontSize: 34,
    fontFamily: "Helvetica-Bold",
  },
  closingText: {
    marginTop: 14,
    fontSize: 21,
    lineHeight: 1.25,
    color: "#edf4ff",
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
  momentHighlights?: MomentHighlight[];
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

function compactNumber(value: number, suffix?: string): string {
  if (suffix === "%") {
    return `${formatNumber(value, Number.isInteger(value) ? 0 : 1)}%`;
  }
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${formatNumber(value / 1_000_000, abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${formatNumber(value / 1_000, abs >= 100_000 ? 0 : 1)}K`;
  return formatNumber(value);
}

function formatDelta(delta: number): string {
  if (!Number.isFinite(delta) || delta === 0) return "stable";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatNumber(delta, Math.abs(delta) < 10 ? 1 : 0)}% vs période précédente`;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function getKpi(props: PdfDocumentProps, candidates: string[]): KpiData | undefined {
  return props.kpis.find((kpi) => {
    const label = sanitizeText(kpi.label).toLowerCase();
    return candidates.some((candidate) => label.includes(candidate));
  });
}

function getGlobalMetrics(props: PdfDocumentProps) {
  const views = getKpi(props, ["vue", "impression"]);
  const reach = getKpi(props, ["portée"]);
  const visibility = views ?? reach ?? props.kpis[0];
  const engagements = getKpi(props, ["engagement"]);
  const followers = getKpi(props, ["abonné"]);
  const posts = getKpi(props, ["publication"]);
  return { visibility, engagements, followers, posts };
}

function slideFooter(tenantName: string, rangeLabel: string) {
  return (
    <View style={styles.footer} fixed>
      <Text>JumpStart Studio x {tenantName} - Social Media Reporting - {rangeLabel}</Text>
      <Text render={({ pageNumber }) => `${pageNumber}`} />
    </View>
  );
}

function SlideHeader({
  title,
  subtitle,
  tenantName,
  rangeLabel,
  watermark,
}: {
  title: string;
  subtitle?: string;
  tenantName: string;
  rangeLabel: string;
  watermark?: string;
}) {
  return (
    <>
      <View style={styles.topBand}>
        <View>
          <Text style={styles.pageTitle}>{title}</Text>
          {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
        </View>
        <Text style={styles.logoText}>JumpStart Studio</Text>
      </View>
      {watermark ? <Text style={styles.watermark}>{watermark}</Text> : null}
      {slideFooter(tenantName, rangeLabel)}
    </>
  );
}

function ProgressBar({
  share,
  value,
  accent = CYAN,
}: {
  share: number;
  value: number;
  accent?: string;
}) {
  const percent = Math.max(4, Math.min(100, share));
  const fillWidth = Math.max(14, Math.round((MIX_BAR_WIDTH * percent) / 100));
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressLabels}>
        <Text>{compactNumber(value)}</Text>
        <Text>{formatNumber(percent)}% du mix</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: fillWidth, backgroundColor: accent }]} />
        <Text style={styles.progressPercent}>{formatNumber(percent)}%</Text>
      </View>
      <Text style={styles.progressCaption}>Part de visibilité du réseau sur la période.</Text>
    </View>
  );
}

function BigMetric({ kpi, label }: { kpi?: KpiData; label: string }) {
  const value = kpi ? compactNumber(kpi.value, kpi.suffix) : "-";
  return (
    <View style={styles.bigMetric}>
      <Text style={styles.bigMetricValue}>{value}</Text>
      <Text style={styles.bigMetricLabel}>{label}</Text>
      {kpi ? <Text style={styles.deltaText}>{formatDelta(kpi.delta)}</Text> : null}
    </View>
  );
}

function platformIcon(platform: string) {
  const normalized = platform.toLowerCase();
  if (normalized.includes("instagram")) return "IG";
  if (normalized.includes("tiktok")) return "TT";
  if (normalized.includes("youtube")) return "YT";
  if (normalized.includes("linkedin")) return "IN";
  if (normalized.includes("facebook")) return "FB";
  if (normalized.includes("twitter") || normalized.includes("x")) return "X";
  return "RS";
}

function platformLabel(platform: string) {
  const normalized = platform.toLowerCase();
  if (normalized === "twitter") return "X";
  return sanitizeText(platform);
}

function PlatformCard({ platform, totalVisibility }: { platform: PlatformSummary; totalVisibility: number }) {
  const visibility = platform.totals.views || platform.totals.reach;
  const visibilityLabel = platform.totals.views ? "vues des contenus." : "personnes touchées.";
  const share = totalVisibility > 0 ? (visibility / totalVisibility) * 100 : 0;
  return (
    <View style={{ width: "31%" }}>
      <Text style={styles.platformIcon}>{platformIcon(platform.platform)}</Text>
      <Text style={styles.platformTitle}>{platformLabel(platform.platform)}</Text>
      <View style={styles.platformCard}>
        <Text style={styles.platformValue}>{compactNumber(platform.totals.posts_count)}</Text>
        <Text style={styles.platformLabel}>publications.</Text>
        <Text style={styles.platformValue}>{compactNumber(visibility)}</Text>
        <Text style={styles.platformLabel}>{visibilityLabel}</Text>
        <ProgressBar value={visibility} share={share} />
      </View>
    </View>
  );
}

function PostCard({ post, index }: { post: PostSummary; index: number }) {
  const card = (
    <View style={styles.postCard}>
      {post.thumbnailUrl ? (
        <Image src={post.thumbnailUrl} style={styles.postImage} />
      ) : (
        <View style={styles.postFallback}>
          <Text>{platformLabel(post.platformLabel ?? post.platform ?? "Post")}</Text>
        </View>
      )}
      <View style={styles.postBody}>
        <Text style={styles.postRank}>Top contenu #{index + 1} - {sanitizeText(post.date)}</Text>
        <Text style={styles.postCaption}>{truncateText(sanitizeText(post.caption || "Sans titre"), 86)}</Text>
        <View style={styles.postNumbers}>
          <View>
            <Text style={styles.postNumberValue}>{compactNumber(post.visibility?.value ?? 0)}</Text>
            <Text style={styles.postNumberLabel}>{sanitizeText(post.visibility?.label ?? "Visibilité")}</Text>
          </View>
          <View>
            <Text style={styles.postNumberValue}>{compactNumber(post.engagements)}</Text>
            <Text style={styles.postNumberLabel}>Interactions</Text>
          </View>
        </View>
      </View>
    </View>
  );

  return post.url ? <Link src={post.url}>{card}</Link> : card;
}

function ActionCard({
  index,
  title,
  text,
  tone = "outline",
}: {
  index: number;
  title: string;
  text: string;
  tone?: "outline" | "filled" | "soft";
}) {
  const cardTone =
    tone === "filled" ? styles.actionCardFilled : tone === "soft" ? styles.actionCardSoft : {};
  return (
    <View style={[styles.actionCard, cardTone]}>
      <Text style={[styles.actionIndex, tone === "filled" ? styles.actionIndexLight : {}]}>{index}</Text>
      <Text style={[styles.actionTitle, tone === "filled" ? styles.actionTitleLight : {}]}>
        {truncateText(sanitizeText(title), 58)}
      </Text>
      <Text style={[styles.actionText, tone === "filled" ? styles.actionTextLight : {}]}>
        {truncateText(sanitizeText(text), 160)}
      </Text>
    </View>
  );
}

function getActions(props: PdfDocumentProps) {
  const opportunities =
    props.opportunities?.slice(0, 3).map((opportunity) => ({
      title: opportunity.title,
      text: opportunity.automation || opportunity.impact || opportunity.evidence,
    })) ?? [];

  if (opportunities.length >= 3) return opportunities;

  const insights =
    props.insights?.slice(0, 3 - opportunities.length).map((insight) => ({
      title: insight.title,
      text: insight.description,
    })) ?? [];

  return [...opportunities, ...insights].slice(0, 3);
}

function SummarySlide(props: PdfDocumentProps) {
  const takeaways = props.keyTakeaways?.map(sanitizeText).filter(Boolean).slice(0, 3) ?? [];
  const summary = sanitizeText(
    props.executiveSummary ??
      props.score?.summary ??
      "La période analysée met en avant les performances sociales majeures, les contenus qui tirent la visibilité et les leviers à activer en priorité."
  );
  const text = takeaways.length > 0 ? takeaways.join(" ") : summary;
  const metrics = getGlobalMetrics(props);
  const mainInsight = sanitizeText(props.insights?.[0]?.description ?? props.score?.summary ?? summary);

  return (
    <Page size={[SLIDE.width, SLIDE.height]} style={styles.page}>
      <View style={styles.content}>
        <Text style={styles.pill}>Résumé général</Text>
        <View style={styles.summaryLayout}>
          <View style={styles.summaryMain}>
            <Text style={styles.summaryText}>{truncateText(text, 720)}</Text>
            <View style={styles.insightStrip}>
              <Text style={styles.insightStripText}>{truncateText(mainInsight, 210)}</Text>
            </View>
          </View>
          <View style={styles.summaryAside}>
            <View style={styles.summaryKpiCard}>
              <Text style={styles.summaryKpiLabel}>Visibilité</Text>
              <Text style={styles.summaryKpiValue}>
                {metrics.visibility ? compactNumber(metrics.visibility.value, metrics.visibility.suffix) : "-"}
              </Text>
              <Text style={styles.summaryKpiHint}>
                {metrics.visibility ? formatDelta(metrics.visibility.delta) : "période analysée"}
              </Text>
            </View>
            <View style={[styles.summaryKpiCard, { backgroundColor: BLUE_DARK }]}>
              <Text style={styles.summaryKpiLabel}>Interactions</Text>
              <Text style={styles.summaryKpiValue}>
                {metrics.engagements ? compactNumber(metrics.engagements.value) : "-"}
              </Text>
              <Text style={styles.summaryKpiHint}>
                {metrics.engagements ? formatDelta(metrics.engagements.delta) : "engagement total"}
              </Text>
            </View>
          </View>
        </View>
      </View>
      {slideFooter(sanitizeText(props.tenantName) || "Client", sanitizeText(props.rangeLabel))}
    </Page>
  );
}

function GlobalStatsSlide(props: PdfDocumentProps) {
  const metrics = getGlobalMetrics(props);
  return (
    <Page size={[SLIDE.width, SLIDE.height]} style={styles.page}>
      <SlideHeader
        title="Statistiques globales"
        subtitle="Sur l'ensemble des réseaux sociaux."
        tenantName={sanitizeText(props.tenantName) || "Client"}
        rangeLabel={sanitizeText(props.rangeLabel)}
        watermark={props.watermark}
      />
      <View style={styles.content}>
        <View style={styles.bigMetricRow}>
          <BigMetric kpi={metrics.visibility} label={metrics.visibility?.label.toLowerCase() ?? "visibilité."} />
          <BigMetric kpi={metrics.engagements} label="interactions." />
          <BigMetric kpi={metrics.followers} label="abonnés." />
        </View>
        <View style={styles.smallKpiRow}>
          <View style={styles.smallKpi}>
            <Text style={styles.smallKpiValue}>{compactNumber(metrics.posts?.value ?? props.posts.length)}</Text>
            <Text style={styles.smallKpiLabel}>publications analysées</Text>
          </View>
          <View style={styles.smallKpi}>
            <Text style={styles.smallKpiValue}>{compactNumber(props.platforms.length)}</Text>
            <Text style={styles.smallKpiLabel}>réseaux couverts</Text>
          </View>
          <View style={styles.smallKpi}>
            <Text style={styles.smallKpiValue}>{props.score ? formatNumber(props.score.global) : "-"}</Text>
            <Text style={styles.smallKpiLabel}>JumpStart Score</Text>
          </View>
          <View style={styles.smallKpi}>
            <Text style={styles.smallKpiValue}>{props.dataQuality ? `${formatNumber(props.dataQuality.overallCoverage)}%` : "-"}</Text>
            <Text style={styles.smallKpiLabel}>couverture data</Text>
          </View>
        </View>
      </View>
    </Page>
  );
}

function PlatformSlide(props: PdfDocumentProps) {
  const platforms = props.platforms
    .slice()
    .sort((a, b) => (b.totals.views || b.totals.reach) - (a.totals.views || a.totals.reach))
    .slice(0, 3);
  const totalVisibility = props.platforms.reduce(
    (total, platform) => total + (platform.totals.views || platform.totals.reach),
    0
  );

  return (
    <Page size={[SLIDE.width, SLIDE.height]} style={styles.page}>
      <SlideHeader
        title="Lecture par réseau"
        subtitle={`Période : ${sanitizeText(props.rangeLabel)}`}
        tenantName={sanitizeText(props.tenantName) || "Client"}
        rangeLabel={sanitizeText(props.rangeLabel)}
        watermark={props.watermark}
      />
      <View style={styles.content}>
        {platforms.length > 0 ? (
          <View style={styles.platformGrid}>
            {platforms.map((platform) => (
              <PlatformCard key={platform.platform} platform={platform} totalVisibility={totalVisibility} />
            ))}
          </View>
        ) : (
          <Text style={styles.summaryText}>Aucune donnée réseau disponible sur cette période.</Text>
        )}
      </View>
    </Page>
  );
}

function PostsSlide(props: PdfDocumentProps) {
  const posts = props.posts.slice(0, 3);
  return (
    <Page size={[SLIDE.width, SLIDE.height]} style={styles.page}>
      <SlideHeader
        title="Contenus qui portent"
        subtitle="Les posts à retenir sur la période."
        tenantName={sanitizeText(props.tenantName) || "Client"}
        rangeLabel={sanitizeText(props.rangeLabel)}
        watermark={props.watermark}
      />
      <View style={styles.content}>
        {posts.length > 0 ? (
          <View style={styles.postGrid}>
            {posts.map((post, index) => (
              <PostCard key={`${post.date}-${index}`} post={post} index={index} />
            ))}
          </View>
        ) : (
          <Text style={styles.summaryText}>Aucun contenu n'est disponible sur cette période.</Text>
        )}
      </View>
    </Page>
  );
}

function ActionsSlide(props: PdfDocumentProps) {
  const actions = getActions(props);
  const fallback = [
    {
      title: "Concentrer l'effort",
      text: "Prioriser les formats et les réseaux qui génèrent déjà la meilleure visibilité.",
    },
    {
      title: "Renforcer la régularité",
      text: "Transformer les pics de performance en rendez-vous éditoriaux plus lisibles.",
    },
    {
      title: "Mesurer plus court",
      text: "Suivre moins d'indicateurs, mais les relier directement aux décisions de production.",
    },
  ];
  const displayed = actions.length > 0 ? actions : fallback;

  return (
    <Page size={[SLIDE.width, SLIDE.height]} style={styles.page}>
      <SlideHeader
        title="Leviers prioritaires"
        subtitle="Ce que l'on recommande d'activer ensuite."
        tenantName={sanitizeText(props.tenantName) || "Client"}
        rangeLabel={sanitizeText(props.rangeLabel)}
        watermark={props.watermark}
      />
      <View style={styles.content}>
        <View style={styles.actionGrid}>
          {displayed.slice(0, 3).map((action, index) => (
            <ActionCard
              key={`${action.title}-${index}`}
              index={index + 1}
              title={action.title}
              text={action.text}
              tone={index === 0 ? "filled" : index === 1 ? "soft" : "outline"}
            />
          ))}
        </View>
      </View>
    </Page>
  );
}

function PilotageSlide(props: PdfDocumentProps) {
  const tenantName = sanitizeText(props.tenantName) || "Client";
  const readiness = buildProductionReadiness({
    shootDaysRemaining: props.shootDays,
    shoots: props.shoots.map((shoot) => ({
      shoot_date: shoot.date,
      location: shoot.location,
    })),
    documents: props.documents,
  });
  const diagnosisItems = props.platformDiagnosis
    ? ([props.platformDiagnosis.primary, props.platformDiagnosis.watch, props.platformDiagnosis.balance].filter(Boolean) as PlatformDiagnosisItem[])
    : [];
  const mixLeader = props.platformMix?.leader ?? diagnosisItems[0]?.platform ?? "-";
  const dominantFormat = props.contentPortfolio?.dominantFormat ?? props.contentDna?.[0]?.label ?? "-";
  const highlight = props.momentHighlights?.[0];

  return (
    <Page size={[SLIDE.width, SLIDE.height]} style={styles.page}>
      <SlideHeader
        title="Pilotage"
        subtitle="Les signaux utiles pour décider vite."
        tenantName={tenantName}
        rangeLabel={sanitizeText(props.rangeLabel)}
        watermark={props.watermark}
      />
      <View style={styles.content}>
        <View style={styles.actionGrid}>
          <ActionCard
            index={1}
            title="Canal moteur"
            text={`${platformLabel(mixLeader)} concentre le signal principal de la période. ${props.platformMix?.concentrationLabel ?? ""}`}
            tone="filled"
          />
          <ActionCard
            index={2}
            title="ADN de contenu"
            text={`${sanitizeText(dominantFormat)} ressort comme repère créatif. ${props.contentPortfolio?.qualityLabel ?? ""}`}
            tone="soft"
          />
          <ActionCard
            index={3}
            title="Production"
            text={`${sanitizeText(readiness.statusLabel)}. ${sanitizeText(readiness.nextShootLabel)} ${sanitizeText(readiness.nextShootLocation)}${highlight ? `. Moment clé : ${sanitizeText(highlight.label)}` : ""}`}
          />
        </View>
      </View>
    </Page>
  );
}

export function PdfDocument(props: PdfDocumentProps) {
  const tenantName = sanitizeText(props.tenantName) || "Client";
  const rangeLabel = sanitizeText(props.rangeLabel);
  const generatedAt = sanitizeText(props.generatedAt);
  const metrics = getGlobalMetrics(props);
  const coverMetric = metrics.visibility ?? metrics.engagements ?? metrics.followers;

  return (
    <Document title={`Social Media Reporting - ${tenantName}`}>
      <Page size={[SLIDE.width, SLIDE.height]} style={styles.coverPage}>
        {props.watermark ? <Text style={styles.watermark}>{sanitizeText(props.watermark)}</Text> : null}
        <View style={styles.coverAccent} />
        <Text style={styles.coverKicker}>Dashboard export</Text>
        <Text style={styles.coverPeriodBadge}>{rangeLabel}</Text>
        <Text style={styles.coverTitle}>Social Media{"\n"}Reporting</Text>
        <Text style={styles.coverMeta}>
          {tenantName}
          {"\n"}
          {rangeLabel}
          {"\n"}Généré le {generatedAt}
        </Text>
        <View style={styles.coverPanel}>
          <Text style={styles.coverPanelLabel}>Signal principal</Text>
          <Text style={styles.coverPanelValue}>
            {coverMetric ? compactNumber(coverMetric.value, coverMetric.suffix) : "-"}
          </Text>
          <Text style={styles.coverPanelText}>
            {coverMetric
              ? `${sanitizeText(coverMetric.label)} - ${formatDelta(coverMetric.delta)}`
              : "Performance sociale consolidée sur la période."}
          </Text>
        </View>
        <Text style={styles.coverBrand}>JumpStart Studio</Text>
      </Page>
      <SummarySlide {...props} />
      <GlobalStatsSlide {...props} />
      <PlatformSlide {...props} />
      <PostsSlide {...props} />
      <ActionsSlide {...props} />
      <PilotageSlide {...props} />
    </Document>
  );
}
