import React from "react";
import { buildReportDailyRows } from "./report-daily-rows";
import { Document, Image, Link, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { DashboardDataQuality } from "./dashboard-data-quality";
import type { DashboardOpportunity } from "./dashboard-opportunities";
import type { PlatformDiagnosis } from "./platform-diagnosis";
import type { ContentPortfolio } from "./content-portfolio";
import type { PlatformMix } from "./platform-mix";
import type { MomentHighlight } from "./moment-highlights";
import type { DashboardMetric } from "./types/dashboard";
import { buildEditorialRoadmap, type EditorialExperiment } from "./editorial-roadmap";
import { computeEngagementRate } from "./metrics";

type KpiData = {
  label: string;
  value: number | null;
  delta: number | null;
  suffix?: string;
};

export type PlatformSummary = {
  platform: string;
  hasCurrentMetrics?: boolean;
  accountNames?: string[];
  prevTotals?: { followers: number; views: number; reach: number; engagements: number; posts_count: number };
  available?: { views: boolean; reach: boolean; engagements: boolean };
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
  metrics?: DashboardMetric[];
  editorialRoadmap?: EditorialExperiment[];
  postsAnalyzed?: number;
};

const INK = "#242238";
const MUTED = "#656375";
const ACCENT = "#7137ce";
const BORDER = "#e5e2eb";
const styles = StyleSheet.create({
  page: { paddingTop: 60, paddingBottom: 57, paddingHorizontal: 42, fontFamily: "Helvetica", fontSize: 10, color: INK },
  header: { position: "absolute", top: 23, left: 42, right: 42, flexDirection: "row", justifyContent: "space-between", paddingBottom: 10, borderBottom: `1 solid ${BORDER}`, fontSize: 8, color: MUTED },
  brand: { color: ACCENT, fontFamily: "Helvetica-Bold", letterSpacing: .6 },
  footer: { position: "absolute", bottom: 23, left: 42, right: 42, flexDirection: "row", justifyContent: "space-between", borderTop: `1 solid ${BORDER}`, paddingTop: 9, color: MUTED, fontSize: 8 },
  kicker: { fontSize: 9, color: ACCENT, fontFamily: "Helvetica-Bold", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 9 },
  title: { fontSize: 30, lineHeight: 1.15, fontFamily: "Helvetica-Bold", marginBottom: 10 },
  subtitle: { fontSize: 11, color: MUTED, marginBottom: 20 },
  h2: { fontSize: 15, lineHeight: 1.25, fontFamily: "Helvetica-Bold", marginTop: 20, marginBottom: 10 },
  h3: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 5 },
  body: { fontSize: 10, lineHeight: 1.5, marginBottom: 9 },
  small: { fontSize: 8, color: MUTED, lineHeight: 1.5 },
  rule: { borderBottom: `1 solid ${BORDER}`, marginVertical: 14 },
  summary: { backgroundColor: "#f6f3fc", padding: 18, borderRadius: 6, marginTop: 12, marginBottom: 12 },
  scoreRow: { flexDirection: "row", gap: 22, marginVertical: 16 },
  score: { width: 115, borderRight: `1 solid ${BORDER}`, paddingRight: 15 },
  scoreValue: { fontSize: 48, fontFamily: "Helvetica-Bold", color: ACCENT, lineHeight: 1.1 },
  metrics: { flexDirection: "row", flexWrap: "wrap", marginVertical: 6 },
  metric: { width: "33.33%", paddingRight: 12, paddingVertical: 13, borderBottom: `1 solid ${BORDER}` },
  metricValue: { fontSize: 23, fontFamily: "Helvetica-Bold", marginTop: 5, lineHeight: 1.2 },
  note: { borderLeft: `3 solid ${ACCENT}`, paddingLeft: 12, marginVertical: 12 },
  tableHeader: { flexDirection: "row", backgroundColor: "#f4f2f7", paddingVertical: 7, borderBottom: `1 solid ${BORDER}`, fontFamily: "Helvetica-Bold", fontSize: 8 },
  tableRow: { flexDirection: "row", paddingVertical: 7, borderBottom: `0.5 solid ${BORDER}`, fontSize: 9 },
  cell: { flex: 1, paddingHorizontal: 6, textAlign: "right" },
  firstCell: { width: "27%", paddingHorizontal: 6 },
  post: { flexDirection: "row", gap: 14, borderBottom: `1 solid ${BORDER}`, paddingVertical: 14 },
  thumbnail: { width: 86, height: 96, objectFit: "cover", borderRadius: 4 },
  link: { color: ACCENT, fontSize: 9, marginTop: 7 },
  experiment: { paddingVertical: 13, borderBottom: `1 solid ${BORDER}` },
});

const platformNames: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", tiktok: "TikTok", youtube: "YouTube", twitter: "X" };
const platformName = (platform: string) => platformNames[platform] ?? platform;
const clean = (text: string) => text.normalize("NFKC").replace(/[\u00a0\u202f]/g, " ").replace(/[\u2010-\u2015]/g, "-").replace(/[^\u000A\u0020-\u00FF\u0152\u0153\u20ac\u2018\u2019\u201c\u201d]/g, "");
function number(value: number | null | undefined, digits = 0): string {
  return value == null || !Number.isFinite(value) ? "N/D" : clean(value.toLocaleString("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: digits }));
}
function evolution(current: number, previous?: number): string {
  if (previous == null || previous <= 0) return "Non comparable";
  const delta = (current - previous) / previous * 100;
  return `${delta > 0 ? "+" : ""}${number(delta, 1)}%`;
}
function safeUrl(url?: string | null): string | undefined {
  return url && /^https?:\/\//i.test(url) ? url : undefined;
}
function ReportPage({ props, children }: { props: PdfDocumentProps; children: React.ReactNode }) {
  return <Page size="A4" style={styles.page}>
    <View fixed style={styles.header}><Text style={styles.brand}>JUMPSTART STUDIO</Text><Text>{props.watermark ? clean(props.watermark) + " · " : ""}Rapport social media</Text></View>
    <Text fixed style={{ position: "absolute", top: 800, left: 42, right: 42, height: 20, fontSize: 8, color: MUTED, textAlign: "right" }} render={({ pageNumber, totalPages }) => `${clean(props.tenantName).slice(0, 65)}  |  ${pageNumber} / ${totalPages}`} />
    {children}
  </Page>;
}
function Heading({ kicker, title, subtitle }: { kicker: string; title: string; subtitle?: string }) {
  return <View minPresenceAhead={80}><Text style={styles.kicker}>{clean(kicker)}</Text><Text style={styles.title}>{clean(title)}</Text>{subtitle && <Text style={styles.subtitle}>{clean(subtitle)}</Text>}</View>;
}
function Metric({ label, value, hint, suffix }: { label: string; value: number | null; hint?: string; suffix?: string }) {
  return <View style={styles.metric} wrap={false}><Text style={styles.small}>{clean(label)}</Text><Text style={styles.metricValue}>{number(value, suffix ? 1 : 0)}{value != null && suffix ? suffix : ""}</Text>{hint && <Text style={[styles.small, { marginTop: 5 }]}>{clean(hint)}</Text>}</View>;
}
function getPlatformNotes(platform: string): string {
  if (platform === "tiktok") return "TikTok : les statistiques de vidéos sont cumulées et rattachées à leur date de publication. La portée stockée est une approximation issue des vues, pas une audience unique. L'historique d'abonnés peut reprendre le stock actuel ; il ne prouve pas la croissance passée.";
  if (platform === "youtube") return "YouTube : les relevés quotidiens dépendent de l'accès Analytics. Les statistiques de vidéos peuvent être des cumuls de la Data API lorsque cet accès manque. La portée unique n'est pas fournie dans ce rapport.";
  return "Les chiffres sont issus des relevés synchronisés. La portée est cumulée par jour et compte : elle n'est pas une audience unique sur la période. Les résultats des publications correspondent aux cumuls disponibles à la collecte.";
}
function PlatformStats({ platform }: { platform: PlatformSummary }) {
  const values = platform.totals;
  const previous = platform.prevTotals;
  const unavailable = (metric: "views" | "reach" | "engagements") => platform.hasCurrentMetrics === false || platform.available?.[metric] === false || (metric === "reach" && ["tiktok", "youtube"].includes(platform.platform));
  const rate = unavailable("engagements") ? null : computeEngagementRate(values.engagements, unavailable("views") ? 0 : values.views, unavailable("reach") ? 0 : values.reach);
  const entries = [
    { key: "followers" as const, label: "Abonnés au dernier relevé", unavailable: platform.hasCurrentMetrics === false },
    { key: "views" as const, label: "Vues", unavailable: unavailable("views") },
    { key: "reach" as const, label: "Portée cumulée", unavailable: unavailable("reach") },
    { key: "engagements" as const, label: "Interactions", unavailable: unavailable("engagements") },
    { key: "posts_count" as const, label: "Publications", unavailable: false },
  ];
  return <>
    <View style={styles.metrics}>{entries.map(entry => <Metric key={entry.key} label={entry.label} value={entry.unavailable ? null : values[entry.key]} hint={entry.unavailable ? "Donnée non disponible ou non native" : entry.key === "followers" && platform.platform === "tiktok" ? "Historique non comparable" : evolution(values[entry.key], previous?.[entry.key])} />)}<Metric label={`Interactions / ${values.views > 0 && !unavailable("views") ? "vues" : "portée"}`} value={rate} suffix="%" hint="Ratio descriptif, sans benchmark" /></View>
    <Text style={styles.h2}>Comparaison détaillée</Text>
    <View style={styles.tableHeader}><Text style={styles.firstCell}>Indicateur</Text><Text style={styles.cell}>Période</Text><Text style={styles.cell}>Précédente</Text><Text style={styles.cell}>Écart absolu</Text><Text style={styles.cell}>Évolution</Text></View>
    {entries.map(entry => <View key={entry.key} style={styles.tableRow} wrap={false}>
      <Text style={styles.firstCell}>{entry.label}</Text><Text style={styles.cell}>{entry.unavailable ? "N/D" : number(values[entry.key])}</Text><Text style={styles.cell}>{entry.unavailable ? "N/D" : number(previous?.[entry.key])}</Text><Text style={styles.cell}>{entry.unavailable || previous == null || (entry.key === "followers" && platform.platform === "tiktok") ? "N/D" : number(values[entry.key] - previous[entry.key])}</Text><Text style={styles.cell}>{entry.unavailable || (entry.key === "followers" && platform.platform === "tiktok") ? "N/D" : evolution(values[entry.key], previous?.[entry.key])}</Text>
    </View>)}
  </>;
}
function platformInterpretation(platform: PlatformSummary): { observation: string; recommendation: string } {
  if (platform.hasCurrentMetrics === false) return { observation: "Aucun relevé statistique n’est disponible pour ce canal sur la période. Cela ne signifie pas une absence d’activité.", recommendation: "Vérifier la dernière collecte avant de comparer les résultats ou d’ajuster la stratégie." };
  const current = platform.totals;
  const previous = platform.prevTotals;
  if (!current.views && !current.reach && !current.engagements) return { observation: "Les métriques disponibles ne permettent pas de conclure sur la performance de ce canal.", recommendation: "Vérifier la collecte et réunir une référence avant de changer le calendrier éditorial." };
  const frequency = `${number(current.posts_count)} publications et ${number(current.engagements)} interactions recensées.`;
  if (!previous || previous.posts_count <= 0 || previous.engagements <= 0 || current.posts_count <= 0) return { observation: `${frequency} L'historique ne permet pas de distinguer l'effet du volume publié de celui des contenus.`, recommendation: "Choisir deux contenus comparables sur ce canal et tester une seule variation d'accroche. Relever leurs résultats sept jours après publication." };
  const previousYield = previous.engagements / previous.posts_count;
  const yieldValue = current.engagements / current.posts_count;
  return { observation: `${frequency} Rapport interactions de période / publications : ${number(yieldValue, 1)}, contre ${number(previousYield, 1)}. Ce ratio ne mesure pas les seules interactions de ces publications : les contenus anciens peuvent aussi contribuer.`, recommendation: yieldValue < previousYield ? "Examiner les sujets et formats qui ont changé, puis répéter un test sur le même canal. Vérifier la couverture avant d'attribuer le recul à la création." : "Préparer une variation d'un contenu marquant de ce canal. Conserver le format et la diffusion comparables pour vérifier si le signal se répète." };
}
function DailyTable({ metrics, platform }: { metrics: DashboardMetric[]; platform: PlatformSummary }) {
  const rows = buildReportDailyRows(metrics, platform.platform, platform.available);
  return <>
    <View style={styles.tableHeader}><Text style={styles.firstCell}>Date du relevé</Text><Text style={styles.cell}>Abonnés*</Text><Text style={styles.cell}>Vues</Text><Text style={styles.cell}>Portée**</Text><Text style={styles.cell}>Interactions</Text></View>
    {rows.map(({ date, ...row }) => <View style={[styles.tableRow, { paddingVertical: 3, fontSize: 8, lineHeight: 1.2 }]} key={date} wrap={false}><Text style={styles.firstCell}>{date.split("-").reverse().join("/")}</Text><Text style={styles.cell}>{number(row.followers)}</Text><Text style={styles.cell}>{number(row.views)}</Text><Text style={styles.cell}>{number(row.reach)}</Text><Text style={styles.cell}>{number(row.engagements)}</Text></View>)}
    {!rows.length && <Text style={styles.body}>Aucun relevé quotidien disponible.</Text>}
    <Text style={[styles.small, { marginTop: 10 }]}>* Somme des comptes disposant d'un relevé ce jour-là, sans report des comptes absents. ** Portée quotidienne cumulée entre comptes. Un jour absent n'est pas un zéro. Sur TikTok, la date correspond à la publication des vidéos, pas au jour de consommation.</Text>
  </>;
}
function PostList({ posts, offset = 0 }: { posts: PostSummary[]; offset?: number }) {
  if (!posts.length) return <Text style={styles.body}>Aucune publication exploitable dans le périmètre sélectionné.</Text>;
  return <>{posts.map((post, index) => <View style={styles.post} wrap={false} key={`${post.url}-${index}`}>
    {/* eslint-disable-next-line jsx-a11y/alt-text */}
    {post.thumbnailUrl ? <Image style={styles.thumbnail} src={post.thumbnailUrl} /> : null}
    <View style={{ flex: 1 }}><Text style={styles.kicker}>{offset + index + 1}. {clean(post.date)}</Text><Text style={styles.body}>{clean(post.caption.length > 420 ? post.caption.slice(0, 420) + "... (extrait)" : post.caption || "Publication sans légende")}</Text>
      <Text style={styles.small}>{number(post.visibility.value)} {post.visibility.label.toLowerCase()} · {number(post.engagements)} interactions · ratio {post.engagementRate == null || !Number.isFinite(post.engagementRate) ? "non disponible" : `${number(post.engagementRate, 1)}%`}</Text>
      {safeUrl(post.url) && <Link style={styles.link} src={safeUrl(post.url)!}>Consulter la publication originale</Link>}
    </View>
  </View>)}</>;
}
export function PdfDocument(props: PdfDocumentProps) {
  const roadmap = props.editorialRoadmap ?? buildEditorialRoadmap([], props.dataQuality?.overallCoverage);
  return <Document title={`Rapport social media - ${props.tenantName} - ${props.rangeLabel}`} author="JumpStart Studio" subject="Résultats, statistiques par plateforme et recommandations éditoriales" language="fr-FR">
    <ReportPage props={props}>
      <Heading kicker="Votre bilan social media" title={props.tenantName} subtitle={`${props.rangeLabel} · Édité le ${props.generatedAt}`} />
      <Text style={styles.small}>Comparaison : {clean(props.prevRangeLabel)}. Les filtres et comptes inclus sont détaillés dans les chapitres par plateforme.</Text>
      <View style={styles.scoreRow}>
        <View style={styles.score}><Text style={[styles.kicker, { letterSpacing: .3, fontSize: 8 }]}>Score JumpStart</Text><Text style={styles.scoreValue}>{props.score ? props.score.global : "N/D"}</Text><Text style={styles.small}>sur 100 · {props.score?.grade ?? "-"}{"\n"}Indice interne, barème v1</Text></View>
        <View style={{ flex: 1 }}><Text style={styles.h3}>La période en bref</Text><Text style={styles.body}>{clean(props.executiveSummary ?? "Lisez les résultats par plateforme pour apprécier cette période.")}</Text><Text style={styles.small}>Couverture : {number(props.dataQuality?.overallCoverage)}% · {props.postsAnalyzed ?? props.posts.length} publications examinées. La couverture indique la présence des données, pas leur exactitude.</Text></View>
      </View>
      <View style={styles.metrics}>{props.kpis.filter(kpi => !kpi.suffix).map(kpi => <Metric key={kpi.label} label={kpi.label} value={kpi.value} hint={kpi.delta == null ? "Comparaison non disponible" : `${kpi.delta > 0 ? "+" : ""}${number(kpi.delta, 1)}% vs période précédente`} />)}</View>
      <View style={styles.note}><Text style={styles.small}>Les audiences et portées ne sont pas dédupliquées entre comptes ou jours. Les définitions diffèrent selon le réseau. Ne pas assimiler les cumuls de vues à des personnes uniques. Le score ne constitue pas une référence sectorielle.</Text></View>
      <Text style={styles.h2}>Dans ce rapport</Text>
      {props.platforms.map((platform, index) => <Text key={platform.platform} style={styles.body}>{`${String(index + 1).padStart(2, "0")}  ${platformName(platform.platform)} : chiffres, lecture des résultats, contenus et relevés.`}</Text>)}
      <Text style={styles.body}>Puis : prochaines semaines, méthode de calcul et qualité des données.</Text>
    </ReportPage>
    {props.platforms.map((platform, index) => {
      const quality = props.dataQuality?.platformQuality.find(item => item.platform === platform.platform);
      const interpretation = platformInterpretation(platform);
      const posts = props.posts.filter(post => post.platform === platform.platform);
      const postsPerPage = posts.some(post => post.thumbnailUrl || post.caption.length > 240) ? 3 : 5;
      const postPages = Array.from({ length: Math.max(1, Math.ceil(posts.length / postsPerPage)) }, (_, page) => posts.slice(page * postsPerPage, (page + 1) * postsPerPage));
      const platformRows = (props.metrics ?? []).filter(row => row.platform === platform.platform);
      const dates = [...new Set(platformRows.map(row => row.date))].sort();
      const chunks = Array.from({ length: Math.max(1, Math.ceil(dates.length / 31)) }, (_, page) => {
        const included = new Set(dates.slice(page * 31, (page + 1) * 31));
        return platformRows.filter(row => included.has(row.date));
      });
      return <React.Fragment key={platform.platform}>
        <ReportPage props={props}>
          <Heading kicker={`Plateforme ${String(index + 1).padStart(2, "0")}`} title={platformName(platform.platform)} subtitle={platform.accountNames?.join(" · ") || "Comptes inclus dans la sélection"} />
          <Text style={styles.small}>Période : {clean(props.rangeLabel)} · Comparaison : {clean(props.prevRangeLabel)}</Text>
          <PlatformStats platform={platform} />
          <Text style={styles.h2}>Lecture des résultats</Text><Text style={styles.body}>{clean(interpretation.observation)}</Text>
          <Text style={styles.h3}>Piste à tester sur ce canal</Text><Text style={styles.body}>{clean(interpretation.recommendation)}</Text>
          <View style={styles.note}><Text style={styles.small}>{quality ? `Couverture du canal : ${quality.coverage}%. ` : "Couverture non mesurée. "}{clean(getPlatformNotes(platform.platform))}</Text></View>
        </ReportPage>
        {postPages.map((pagePosts, page) => <ReportPage props={props} key={`posts-${page}`}>
          <Heading kicker={platformName(platform.platform)} title="Les contenus à retenir" subtitle={`Sélection par performance relative parmi les publications collectées${postPages.length > 1 ? ` · ${page + 1}/${postPages.length}` : ""}.`} />
          <Text style={styles.small}>Les cumuls dépendent de l'âge des contenus. Les liens permettent de consulter les originaux ; les résultats peuvent avoir évolué depuis la collecte.</Text>
          <PostList posts={pagePosts} offset={page * postsPerPage} />
        </ReportPage>)}
        {chunks.map((rows, page) => <ReportPage props={props} key={page}>
          <Heading kicker={platformName(platform.platform)} title="Le détail des relevés" subtitle={`Les chiffres disponibles, jour par jour${chunks.length > 1 ? ` · ${page + 1}/${chunks.length}` : ""}.`} />
          <DailyTable metrics={rows} platform={platform} />
        </ReportPage>)}
      </React.Fragment>;
    })}
    <ReportPage props={props}>
      <Heading kicker="Prochain cycle" title="Les prochaines semaines" subtitle="Un protocole éditorial à caler avec le client, sans promesse de résultat." />
      {roadmap.map(experiment => <View style={styles.experiment} key={experiment.week} wrap={false}><Text style={styles.kicker}>{experiment.week}</Text><Text style={styles.h3}>{clean(experiment.title)}</Text><Text style={styles.body}>{clean(experiment.action)}</Text><Text style={styles.small}>Point de départ : {clean(experiment.evidence)}</Text><Text style={[styles.small, { marginTop: 6 }]}>Critère de suivi : {clean(experiment.measure)}</Text></View>)}
    </ReportPage>
    <ReportPage props={props}>
      <Heading kicker="Pour bien interpréter" title="Méthode et qualité des données" />
      <Text style={styles.h3}>Périmètre et collecte</Text><Text style={styles.body}>Le rapport reprend les données synchronisées pour les comptes et dates sélectionnés. Une connexion active ne garantit pas la disponibilité de toutes les métriques. N/D signifie non disponible ou non interprétable ; un zéro peut aussi provenir d'une donnée absente dans un ancien relevé.</Text>
      <Text style={styles.h3}>Comparaisons</Text><Text style={styles.body}>Évolution = (valeur actuelle - valeur précédente) / valeur précédente. Si la base précédente est nulle ou absente, le pourcentage est non comparable. Les périodes ont la même durée calendaire ; la période précédente peut donc différer du mois civil précédent. Les comparaisons restent descriptives si les comptes, la couverture ou les sources diffèrent.</Text>
      <Text style={styles.h3}>Portée, vues et interactions</Text><Text style={styles.body}>La portée cumulée additionne des relevés qui peuvent inclure plusieurs fois une même personne. Les vues et impressions ne sont pas interchangeables avec une audience unique. Le ratio d'interactions utilise les vues disponibles, sinon la portée ; aucun benchmark sectoriel n'est appliqué. Les interactions ne constituent pas une mesure de ventes ou de retour sur investissement.</Text>
      <Text style={styles.h3}>Score JumpStart</Text><Text style={styles.body}>Barème interne v1 : croissance 25%, portée 25%, engagement 25%, régularité 15%, momentum 10%. Références internes : cadence de 12 publications par mois, croissance de 3% sur la période, ratio d'interactions de 3% correspondant à 70/100. Certaines données absentes sont neutralisées, d'autres peuvent pénaliser le score. Comparez le score à durée, périmètre et couverture similaires.</Text>
      {props.score?.subScores.map(sub => <Text key={sub.label} style={styles.small}>{clean(sub.label)} : {number(sub.value)} / 100</Text>)}
      <Text style={styles.h2}>État de la collecte</Text>
      {props.dataQuality?.platformQuality.map(item => <Text key={item.platform} style={styles.body}>{platformName(item.platform)} : {item.coverage}% de couverture sur {item.accounts} compte(s). {item.missingMetrics.length ? `Métriques à contrôler : ${item.missingMetrics.map(metric => ({ views: "vues", reach: "portée", engagements: "interactions" }[metric])).join(", ")}.` : ""}</Text>)}
      <Text style={styles.small}>{props.dataQuality?.staleSync ? "La dernière synchronisation est ancienne, absente ou n'a pas abouti. Vérifier la collecte avant de conclure." : "La date d'édition du rapport n'est pas la date de collecte de chaque métrique."}</Text>
      {props.dataQuality?.actions.map(action => <Text key={action} style={[styles.small, { marginTop: 6 }]}>{clean(action)}</Text>)}
    </ReportPage>
  </Document>;
}
