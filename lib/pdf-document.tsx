import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 16,
    marginBottom: 20,
  },
  brand: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#64748b",
  },
  title: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    marginTop: 4,
  },
  meta: {
    fontSize: 10,
    color: "#64748b",
    textAlign: "right",
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginTop: 20,
    marginBottom: 12,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  kpiCard: {
    width: "23%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#64748b",
    marginBottom: 4,
  },
  kpiValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kpiValue: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
  },
  deltaPositive: {
    fontSize: 9,
    color: "#059669",
    fontFamily: "Helvetica-Bold",
  },
  deltaNegative: {
    fontSize: 9,
    color: "#dc2626",
    fontFamily: "Helvetica-Bold",
  },
  deltaZero: {
    fontSize: 9,
    color: "#64748b",
  },
  table: {
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 6,
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#64748b",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  tableCell: {
    fontSize: 9,
  },
  colWide: {
    width: "40%",
  },
  colMedium: {
    width: "20%",
  },
  colNarrow: {
    width: "15%",
  },
  platformGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  platformCard: {
    width: "31%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
  },
  platformName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    textTransform: "capitalize",
  },
  platformMetric: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  platformLabel: {
    fontSize: 8,
    color: "#64748b",
  },
  platformValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  collaborationGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  collaborationCard: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
  },
  collaborationTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  listItem: {
    fontSize: 9,
    marginBottom: 3,
    color: "#334155",
  },
  tag: {
    fontSize: 8,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
    color: "#64748b",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#94a3b8",
  },
  comparisonRow: {
    fontSize: 8,
    color: "#64748b",
    marginTop: 2,
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
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
}

function sanitizeText(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7EÀ-ÖØ-öø-ÿ’“”«»—–·•]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function formatDelta(delta: number): string {
  if (delta === 0) return "0%";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${Math.round(delta)}%`;
}

function DeltaText({ delta }: { delta: number }) {
  if (delta === 0) {
    return <Text style={styles.deltaZero}>0%</Text>;
  }
  return (
    <Text style={delta > 0 ? styles.deltaPositive : styles.deltaNegative}>
      {formatDelta(delta)}
    </Text>
  );
}

function KpiCard({ kpi }: { kpi: KpiData }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{kpi.label}</Text>
      <View style={styles.kpiValueRow}>
        <Text style={styles.kpiValue}>
          {formatNumber(kpi.value)}
          {kpi.suffix ? kpi.suffix : ""}
        </Text>
        <DeltaText delta={kpi.delta} />
      </View>
    </View>
  );
}

function PlatformCard({ platform }: { platform: PlatformSummary }) {
  const metrics = [
    { label: "Abonnés", value: platform.totals.followers, delta: platform.delta.followers },
    { label: "Vues", value: platform.totals.views, delta: platform.delta.views },
    { label: "Portée", value: platform.totals.reach, delta: platform.delta.reach },
    { label: "Engagements", value: platform.totals.engagements, delta: platform.delta.engagements },
    { label: "Publications", value: platform.totals.posts_count, delta: platform.delta.posts_count },
  ].filter((m) => m.value > 0 || m.delta !== 0);

  return (
    <View style={styles.platformCard}>
      <Text style={styles.platformName}>{platform.platform}</Text>
      {metrics.map((metric, index) => (
        <View key={index} style={styles.platformMetric}>
          <Text style={styles.platformLabel}>{metric.label}</Text>
          <View style={{ flexDirection: "row", gap: 4 }}>
            <Text style={styles.platformValue}>{formatNumber(metric.value)}</Text>
            <DeltaText delta={metric.delta} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function PdfDocument(props: PdfDocumentProps) {
  const {
    tenantName,
    rangeLabel,
    prevRangeLabel,
    generatedAt,
    kpis,
    platforms,
    posts,
    shootDays,
    shoots,
    documents,
  } = props;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>JumpStart Studio</Text>
            <Text style={styles.title}>{tenantName} • Social Pulse</Text>
            <Text style={styles.meta}>Période : {rangeLabel}</Text>
            <Text style={styles.comparisonRow}>vs. {prevRangeLabel}</Text>
          </View>
          <View>
            <Text style={styles.meta}>Généré le {generatedAt}</Text>
          </View>
        </View>

        {/* KPIs */}
        <Text style={styles.sectionTitle}>Indicateurs clés</Text>
        <View style={styles.kpiGrid}>
          {kpis.map((kpi, index) => (
            <KpiCard key={index} kpi={kpi} />
          ))}
        </View>

        {/* Platforms breakdown */}
        {platforms.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Performance par plateforme</Text>
            <View style={styles.platformGrid}>
              {platforms.map((platform, index) => (
                <PlatformCard key={index} platform={platform} />
              ))}
            </View>
          </>
        )}

        {/* Top Posts */}
        {posts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Top contenus</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.colWide]}>Publication</Text>
                <Text style={[styles.tableHeaderCell, styles.colNarrow]}>Date</Text>
                <Text style={[styles.tableHeaderCell, styles.colMedium]}>Visibilite</Text>
                <Text style={[styles.tableHeaderCell, styles.colMedium]}>Engagements</Text>
              </View>
              {posts.slice(0, 8).map((post, index) => {
                const caption = sanitizeText(post.caption);
                return (
                  <View key={index} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.colWide]}>
                      {caption.slice(0, 60)}
                      {caption.length > 60 ? "..." : ""}
                    </Text>
                    <Text style={[styles.tableCell, styles.colNarrow]}>{post.date}</Text>
                    <Text style={[styles.tableCell, styles.colMedium]}>
                      {formatNumber(post.visibility.value)} {post.visibility.label}
                    </Text>
                    <Text style={[styles.tableCell, styles.colMedium]}>{formatNumber(post.engagements)}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Collaboration */}
        <Text style={styles.sectionTitle}>Collaboration</Text>
        <View style={styles.collaborationGrid}>
          <View style={styles.collaborationCard}>
            <Text style={styles.collaborationTitle}>Prochains shootings</Text>
            <Text style={styles.listItem}>Jours restants : {shootDays}</Text>
            {shoots.length > 0 ? (
              shoots.slice(0, 4).map((shoot, index) => (
                <Text key={index} style={styles.listItem}>
                  • {shoot.date} - {sanitizeText(shoot.location || "Lieu à définir")}
                </Text>
              ))
            ) : (
              <Text style={styles.listItem}>Aucun shooting planifié</Text>
            )}
          </View>
          <View style={styles.collaborationCard}>
            <Text style={styles.collaborationTitle}>Documents partagés</Text>
            {documents.length > 0 ? (
              documents.slice(0, 5).map((doc, index) => (
                <View key={index} style={{ flexDirection: "row", marginBottom: 3, alignItems: "center" }}>
                  <Text style={styles.listItem}>• {sanitizeText(doc.name)}</Text>
                  <Text style={styles.tag}>{sanitizeText(doc.tag)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.listItem}>Aucun document partagé</Text>
            )}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Rapport généré par JumpStart Studio</Text>
          <Text>Les variations (%) comparent la période actuelle à la période précédente équivalente</Text>
        </View>
      </Page>
    </Document>
  );
}
