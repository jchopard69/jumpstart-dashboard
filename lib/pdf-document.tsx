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
  pageLabel: {
    fontSize: 8,
    color: "#94a3b8",
    textAlign: "right",
    marginBottom: 16,
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
  // Premium: JumpStart Score & Insights
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
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })
    .format(value)
    // Replace narrow no-break space (U+202F) and no-break space (U+00A0) with regular space
    // @react-pdf Helvetica doesn't support these Unicode chars, rendering them as slashes
    .replace(/[\u00A0\u202F]/g, " ");
}

function sanitizeText(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7EÀ-ÖØ-öø-ÿ'""«»—–·•]/g, "")
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

function StrengthBar({ strength }: { strength: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
      <View style={{ width: 60, height: 4, backgroundColor: "#e2e8f0", borderRadius: 2 }}>
        <View style={{ width: `${Math.min(100, strength)}%`, height: 4, backgroundColor: "#7c3aed", borderRadius: 2 }} />
      </View>
      <Text style={{ fontSize: 7, color: "#64748b" }}>{strength}%</Text>
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
    score,
    keyTakeaways,
    executiveSummary,
    insights,
    contentDna,
  } = props;

  return (
    <Document>
      {/* PAGE 1 — Synthese executive */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>JumpStart Studio</Text>
            <Text style={styles.title}>{tenantName} -- Rapport Social</Text>
            <Text style={styles.meta}>Periode : {rangeLabel}</Text>
            <Text style={styles.comparisonRow}>vs. {prevRangeLabel}</Text>
          </View>
          <View>
            <Text style={styles.meta}>Genere le {generatedAt}</Text>
          </View>
        </View>

        {/* JumpStart Score */}
        {score && (
          <View style={{ flexDirection: "row", gap: 16, marginTop: 4, marginBottom: 16 }}>
            <View style={{ width: "25%", borderWidth: 2, borderColor: "#7c3aed", borderRadius: 12, padding: 12, alignItems: "center" }}>
              <Text style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: 1, color: "#64748b", marginBottom: 4 }}>JumpStart Score</Text>
              <Text style={{ fontSize: 28, fontFamily: "Helvetica-Bold", color: "#7c3aed" }}>{score.global}</Text>
              <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: "#059669", marginTop: 2 }}>{score.grade}</Text>
            </View>
            <View style={{ flex: 1 }}>
              {score.subScores.map((sub, i) => (
                <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                  <Text style={{ fontSize: 9, color: "#64748b" }}>{sub.label}</Text>
                  <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>{Math.round(sub.value)}/100</Text>
                </View>
              ))}
              {executiveSummary && (
                <Text style={{ fontSize: 8, color: "#64748b", marginTop: 6 }}>{sanitizeText(executiveSummary)}</Text>
              )}
            </View>
            {keyTakeaways && keyTakeaways.length > 0 && (
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: 1, color: "#64748b", marginBottom: 6 }}>A retenir</Text>
                {keyTakeaways.map((t, i) => (
                  <Text key={i} style={{ fontSize: 8, color: "#334155", marginBottom: 3 }}>-- {sanitizeText(t)}</Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Score Methodology */}
        {score && (
          <View style={{ marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 6, padding: 8, backgroundColor: "#f8fafc" }}>
            <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: "#64748b", marginBottom: 3 }}>Methodologie JumpStart Score</Text>
            <Text style={{ fontSize: 7, color: "#64748b", lineHeight: 1.4 }}>
              Indice composite (0-100) sur 5 axes : Croissance (25%), Portee (25%), Engagement (25%), Regularite (15%), Momentum (10%). Chaque axe est normalise selon des benchmarks sectoriels. La note ({score.grade}) resume la performance globale.
            </Text>
          </View>
        )}

        {/* Strategic Insights */}
        {insights && insights.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Analyse strategique</Text>
            <View style={{ marginBottom: 12 }}>
              {insights.slice(0, 4).map((insight, i) => (
                <View key={i} style={{ marginBottom: 6, borderLeftWidth: 2, borderLeftColor: "#7c3aed", paddingLeft: 8 }}>
                  <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: "#1e293b" }}>{sanitizeText(insight.title)}</Text>
                  <Text style={{ fontSize: 8, color: "#64748b", marginTop: 1 }}>{sanitizeText(insight.description)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* KPIs */}
        <Text style={styles.sectionTitle}>Indicateurs de performance</Text>
        <View style={styles.kpiGrid}>
          {kpis.map((kpi, index) => (
            <KpiCard key={index} kpi={kpi} />
          ))}
        </View>

        {/* Content DNA */}
        {contentDna && contentDna.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>ADN de contenu</Text>
            <Text style={{ fontSize: 7, color: "#64748b", marginBottom: 6 }}>
              Analyse des patterns gagnants (format, creneau horaire, longueur de legende) par comparaison des engagements moyens par categorie. La barre de confiance mesure la surperformance vs la moyenne.
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {contentDna.map((pattern, i) => (
                <View key={i} style={{ flex: 1, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 10 }}>
                  <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#7c3aed", marginBottom: 4 }}>{sanitizeText(pattern.label)}</Text>
                  <Text style={{ fontSize: 8, color: "#1e293b", marginBottom: 2 }}>{sanitizeText(pattern.insight)}</Text>
                  <Text style={{ fontSize: 7, color: "#64748b" }}>{sanitizeText(pattern.detail)}</Text>
                  <StrengthBar strength={pattern.strength} />
                </View>
              ))}
            </View>
          </>
        )}

        {/* Footer Page 1 */}
        <View style={styles.footer}>
          <Text>Rapport genere par JumpStart Studio</Text>
          <Text>Page 1/2 -- Synthese</Text>
        </View>
      </Page>

      {/* PAGE 2 — Donnees detaillees */}
      <Page size="A4" style={styles.page}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
          <View>
            <Text style={styles.brand}>JumpStart Studio</Text>
            <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 2 }}>{tenantName} -- Donnees detaillees</Text>
          </View>
          <Text style={styles.pageLabel}>{rangeLabel}</Text>
        </View>

        {/* Platforms breakdown */}
        {platforms.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Ecosysteme digital</Text>
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
            <Text style={styles.sectionTitle}>Contenus phares</Text>
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
                  -- {shoot.date} - {sanitizeText(shoot.location || "Lieu a definir")}
                </Text>
              ))
            ) : (
              <Text style={styles.listItem}>Aucun shooting planifie</Text>
            )}
          </View>
          <View style={styles.collaborationCard}>
            <Text style={styles.collaborationTitle}>Documents partages</Text>
            {documents.length > 0 ? (
              documents.slice(0, 5).map((doc, index) => (
                <View key={index} style={{ flexDirection: "row", marginBottom: 3, alignItems: "center" }}>
                  <Text style={styles.listItem}>-- {sanitizeText(doc.name)}</Text>
                  <Text style={styles.tag}>{sanitizeText(doc.tag)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.listItem}>Aucun document partage</Text>
            )}
          </View>
        </View>

        {/* Footer Page 2 */}
        <View style={styles.footer}>
          <Text>Les variations (%) comparent la periode selectionnee a la periode precedente equivalente</Text>
          <Text>Page 2/2 -- Donnees</Text>
        </View>
      </Page>
    </Document>
  );
}
