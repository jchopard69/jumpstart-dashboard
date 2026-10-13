import type { MeasuredFields } from "./measurement";
import type { ContentObservatory } from "./content-observatory";
import type { StrategicSignal } from "./strategic-reading";
import type { BestTimeData } from "./best-time";
import React from "react";
import { buildReportDailyRows } from "./report-daily-rows";
import { Document, Image, Link, Page, Text, View, StyleSheet, Svg, Polyline, Line } from "@react-pdf/renderer";
import type { DashboardDataQuality } from "./dashboard-data-quality";
import type { DashboardOpportunity } from "./dashboard-opportunities";
import type { PlatformDiagnosis } from "./platform-diagnosis";
import type { ContentPortfolio } from "./content-portfolio";
import type { PlatformMix } from "./platform-mix";
import type { MomentHighlight } from "./moment-highlights";
import type { DashboardMetric } from "./types/dashboard";
import { type EditorialExperiment } from "./editorial-roadmap";
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
  hasPreviousMetrics?: boolean;
  measured?: MeasuredFields;
  previousMeasured?: MeasuredFields;
  accountNames?: string[];
  prevTotals?: { impressions?:number; watch_time?:number; followers: number; views: number; reach: number; engagements: number; posts_count: number };
  available?: { views: boolean; reach: boolean; engagements: boolean };
  totals: {
    impressions?:number;
    watch_time?:number;
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
    label: "Impressions" | "Vues" | "Portée" | "Spectateurs uniques";
    value: number;
  };
  engagements: number | null;
  details?: {label:string;value:number}[];
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
  strategicSignals?: StrategicSignal[];
  contentObservatory?: ContentObservatory;
  bestTimes?: BestTimeData[];
  rangeLabel: string;
  prevRangeLabel: string;
  generatedAt: string;
  kpis: KpiData[];
  platforms: PlatformSummary[];
  posts: PostSummary[];
  postLimitPerPlatform?: number;
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
  masthead: { backgroundColor:"#251c3d",padding:18,borderRadius:9,marginBottom:15 },
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
  metric: { width: "33.33%", paddingRight: 12, paddingVertical: 10, borderBottom: `1 solid ${BORDER}` },
  metricValue: { fontSize: 23, fontFamily: "Helvetica-Bold", marginTop: 5, lineHeight: 1.2 },
  note: { borderLeft: `3 solid ${ACCENT}`, paddingLeft: 12, marginVertical: 12 },
  tableHeader: { flexDirection: "row", backgroundColor: "#f4f2f7", paddingVertical: 7, borderBottom: `1 solid ${BORDER}`, fontFamily: "Helvetica-Bold", fontSize: 8 },
  tableRow: { flexDirection: "row", paddingVertical: 7, borderBottom: `0.5 solid ${BORDER}`, fontSize: 9 },
  cell: { flex: 1, paddingHorizontal: 6, textAlign: "right" },
  firstCell: { width: "27%", paddingHorizontal: 6 },
  post: { flexDirection: "row", gap: 12, borderBottom: `1 solid ${BORDER}`, paddingVertical: 9 },
  thumbnail: { width: 67, height: 76, objectFit: "cover", borderRadius: 4 },
  link: { color: ACCENT, fontSize: 9, marginTop: 7 },
  experiment: { paddingVertical: 10, borderBottom: `1 solid ${BORDER}` },
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
  return <View minPresenceAhead={80} style={styles.masthead}><Text style={[styles.kicker,{color:"#c6a3ff"}]}>{clean(kicker)}</Text><Text style={[styles.title,{color:"#ffffff"}]}>{clean(title)}</Text>{subtitle && <Text style={[styles.subtitle,{color:"#ddd2eb",marginBottom:0,fontSize:10}]}>{clean(subtitle)}</Text>}</View>;
}
function Metric({ label, value, hint, suffix, wide = false }: { label: string; value: number | null; hint?: string; suffix?: string; wide?: boolean }) {
  return <View style={[styles.metric, wide ? {width:"50%",paddingVertical:12} : {}]} wrap={false}><Text style={styles.small}>{clean(label)}</Text><Text style={styles.metricValue}>{number(value, suffix ? 1 : 0)}{value != null && suffix ? suffix : ""}</Text>{hint && <Text style={[styles.small, { marginTop: 5 }]}>{clean(hint)}</Text>}</View>;
}
function getPlatformNotes(platform: string): string {
  if (platform === "tiktok") return "TikTok : les statistiques de vidéos sont cumulées et rattachées à leur date de publication. La portée stockée est une approximation issue des vues, pas une audience unique. L'historique d'abonnés peut reprendre le stock actuel ; il ne prouve pas la croissance passée.";
  if (platform === "youtube") return "YouTube : les relevés quotidiens dépendent de l'accès Analytics. Les statistiques de vidéos peuvent être des cumuls de la Data API lorsque cet accès manque. La portée unique n'est pas fournie dans ce rapport.";
  return "Les chiffres sont issus des relevés synchronisés. La portée est cumulée par jour et compte : elle n'est pas une audience unique sur la période. Les résultats des publications correspondent aux cumuls disponibles à la collecte.";
}
function PlatformStats({ platform }: { platform: PlatformSummary }) {
  const values = platform.totals;
  const previous = platform.prevTotals;
  const unavailable = (metric: "views" | "reach" | "engagements") => platform.hasCurrentMetrics === false || platform.available?.[metric] === false || platform.measured?.[metric] === false || (metric === "reach" && ["tiktok", "youtube"].includes(platform.platform));
  const rate = unavailable("engagements") ? null : computeEngagementRate(values.engagements, unavailable("views") ? 0 : values.views, unavailable("reach") ? 0 : values.reach);
  const entries = [
    { key: "followers" as const, label: "Abonnés au dernier relevé", unavailable: platform.hasCurrentMetrics === false || platform.measured?.followers === false },
    { key: "views" as const, label: "Vues", unavailable: unavailable("views") },
    { key: "reach" as const, label: "Portée cumulée", unavailable: unavailable("reach") },
    { key: "engagements" as const, label: "Interactions", unavailable: unavailable("engagements") },
    { key: "posts_count" as const, label: "Publications", unavailable: false },
  ].filter(entry => entry.key !== "reach" || !entry.unavailable);
  const previousValue = (key: 'followers'|'views'|'reach'|'engagements'|'posts_count') => key !== 'posts_count' && (platform.hasPreviousMetrics === false || platform.previousMeasured?.[key] === false) ? undefined : previous?.[key];
  return <>
    <View style={styles.metrics}>{entries.map(entry => <Metric key={entry.key} label={entry.label} value={entry.unavailable ? null : values[entry.key]} hint={entry.unavailable ? "Donnée non disponible ou non native" : entry.key === "followers" && platform.platform === "tiktok" ? "Historique non comparable" : evolution(values[entry.key], previousValue(entry.key))} />)}<Metric label={`Interactions / ${values.views > 0 && !unavailable("views") ? "vues" : "portée"}`} value={rate} suffix="%" hint="Ratio descriptif, sans benchmark" /></View>
    {((values.impressions??0)>0 || (platform.platform==='youtube' && (values.watch_time??0)>0))&&<View style={styles.note}>{(values.impressions??0)>0&&<Text style={styles.body}>Impressions : {number(values.impressions)} · précédent : {number(previous?.impressions)} · {evolution(values.impressions!,previous?.impressions)}</Text>}{platform.platform==='youtube'&&(values.watch_time??0)>0&&<Text style={styles.body}>Minutes regardées : {number(values.watch_time)} · précédent : {number(previous?.watch_time)} · {evolution(values.watch_time!,previous?.watch_time)}</Text>}</View>}
    <Text style={styles.h2}>Comparaison détaillée</Text>
    <View style={styles.tableHeader}><Text style={styles.firstCell}>Indicateur</Text><Text style={styles.cell}>Période</Text><Text style={styles.cell}>Précédente</Text><Text style={styles.cell}>Écart absolu</Text><Text style={styles.cell}>Évolution</Text></View>
    {entries.map(entry => <View key={entry.key} style={styles.tableRow} wrap={false}>
      <Text style={styles.firstCell}>{entry.label}</Text><Text style={styles.cell}>{entry.unavailable ? "N/D" : number(values[entry.key])}</Text><Text style={styles.cell}>{entry.unavailable ? "N/D" : number(previousValue(entry.key))}</Text><Text style={styles.cell}>{entry.unavailable || previousValue(entry.key) == null || (entry.key === "followers" && platform.platform === "tiktok") ? "N/D" : number(values[entry.key] - previousValue(entry.key)!)}</Text><Text style={styles.cell}>{entry.unavailable || (entry.key === "followers" && platform.platform === "tiktok") ? "N/D" : evolution(values[entry.key], previousValue(entry.key))}</Text>
    </View>)}
  </>;
}
function DailyTrend({metrics,platform}:{metrics:DashboardMetric[];platform:PlatformSummary}) {
  const rows=buildReportDailyRows(metrics,platform.platform,platform.available).filter(row=>row.engagements!=null);
  if(rows.length<2)return null;
  const start=new Date(rows[0].date).getTime(), end=new Date(rows[rows.length-1].date).getTime();
  const max=Math.max(1,...rows.map(r=>r.engagements!));
  const segments:typeof rows[]=[];
  for(const row of rows){const last=segments.at(-1);if(!last||new Date(row.date).getTime()-new Date(last.at(-1)!.date).getTime()>86400000)segments.push([row]);else last.push(row);}
  return <View style={{marginTop:14,marginBottom:8}} wrap={false}><Text style={styles.small}>INTERACTIONS QUOTIDIENNES · maximum {number(max)}</Text><Svg width={500} height={60} viewBox="0 0 500 60"><Line x1={0} y1={55} x2={500} y2={55} stroke={BORDER}/>{segments.map((segment,i)=><Polyline key={i} points={segment.map(r=>`${((new Date(r.date).getTime()-start)/Math.max(1,end-start))*495},${55-(r.engagements!/max)*48}`).join(' ')} fill="none" stroke={ACCENT} strokeWidth={1.7}/>)}</Svg><View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={styles.small}>{rows[0].date.split('-').reverse().join('/')}</Text><Text style={styles.small}>{rows.at(-1)!.date.split('-').reverse().join('/')}</Text></View></View>;
}
function PostList({ posts }: { posts: PostSummary[] }) {
  if (!posts.length) return <Text style={styles.body}>Aucun contenu avec une mesure de visibilité disponible.</Text>;
  return <>{posts.map((post, index) => <View style={styles.post} wrap={false} key={`${post.url}-${index}`}>
    {post.thumbnailUrl ? <Image style={styles.thumbnail} src={post.thumbnailUrl} /> : <View style={[styles.thumbnail,{backgroundColor:"#f3eff8",justifyContent:"center",padding:5}]}><Text style={styles.small}>Sans aperçu</Text></View>}
    <View style={{flex:1}}>
      <Text style={[styles.kicker,{fontSize:8,marginBottom:4}]}>{index+1} · {clean(post.date)}</Text>
      <Text style={[styles.body,{fontSize:9,marginBottom:4,lineHeight:1.25}]}>{clean((post.caption || "Publication sans légende").replace(/\s+/g," ").slice(0,115))}{post.caption.length>115?"...":""}</Text>
      <Text style={{fontSize:17,fontFamily:"Helvetica-Bold",color:ACCENT}}>{number(post.visibility.value)} <Text style={{fontSize:9}}>{post.visibility.label.toLowerCase()}</Text></Text>
      <Text style={styles.small}>{number(post.engagements)} interactions{post.engagementRate!=null && Number.isFinite(post.engagementRate)?` · ratio ${number(post.engagementRate,1)}%`:""}</Text>
      {safeUrl(post.url) && <Link style={[styles.link,{fontSize:8,marginTop:3}]} src={safeUrl(post.url)!}>Voir la publication</Link>}
    </View>
  </View>)}</>;
}
export function PdfDocument(props: PdfDocumentProps) {
  return <Document title={`Rapport social media - ${props.tenantName} - ${props.rangeLabel}`} author="JumpStart Studio" subject="Bilan mensuel, résultats par réseau et top 5 des contenus" language="fr-FR">
    <ReportPage props={props}>
      <Heading kicker="Bilan social media" title={props.tenantName} subtitle={props.rangeLabel}/>
      <Text style={styles.small}>Comparé au {clean(props.prevRangeLabel)} · Édité le {clean(props.generatedAt)}</Text>
      <View style={styles.metrics}>{props.kpis.filter(kpi=>!kpi.suffix).map(kpi=><Metric wide key={kpi.label} label={kpi.label} value={kpi.value} hint={kpi.delta==null?"Comparaison indisponible":`${kpi.delta>0?"+":""}${number(kpi.delta,1)}% vs mois précédent`}/>)}</View>
      <View style={styles.summary}><Text style={styles.h3}>Le mois en bref</Text><Text style={[styles.body,{marginBottom:0}]}>{clean(props.executiveSummary ?? "Consultez les résultats par réseau dans les pages suivantes.")}</Text></View>
      <Text style={styles.h2}>Les résultats par réseau</Text>
      <View style={styles.tableHeader}><Text style={styles.firstCell}>Réseau</Text><Text style={styles.cell}>Vues*</Text><Text style={styles.cell}>Interactions</Text><Text style={styles.cell}>Publications</Text></View>
      {props.platforms.map(platform=><View style={styles.tableRow} wrap={false} key={platform.platform}><Text style={styles.firstCell}>{platformName(platform.platform)}</Text><Text style={styles.cell}>{platform.hasCurrentMetrics===false || platform.available?.views===false || platform.measured?.views===false ? "N/D":number(platform.totals.views)}</Text><Text style={styles.cell}>{platform.hasCurrentMetrics===false || platform.measured?.engagements===false ? "N/D":number(platform.totals.engagements)}</Text><Text style={styles.cell}>{number(platform.totals.posts_count)}</Text></View>)}
      <View style={styles.note}><Text style={styles.small}>* Les définitions de visibilité diffèrent selon le réseau. Vues et impressions ne représentent pas des personnes uniques. N/D : donnée indisponible. Les comparaisons non exploitables sont signalées.</Text><Text style={[styles.small,{marginTop:5}]}>Couverture des relevés : {number(props.dataQuality?.overallCoverage)}% · {props.postsAnalyzed ?? props.posts.length} publications collectées. Tous les résultats du mois sont inclus ; seules les illustrations sont limitées au top 5.</Text></View>
    </ReportPage>
    {props.platforms.map(platform=>{
      const quality=props.dataQuality?.platformQuality.find(item=>item.platform===platform.platform);
      const posts=props.posts.filter(post=>post.platform===platform.platform).slice(0,5);
      return <React.Fragment key={platform.platform}>
        <ReportPage props={props}>
          <Heading kicker="Résultats du mois" title={platformName(platform.platform)} subtitle={platform.accountNames?.join(" · ") || props.rangeLabel}/>
          <Text style={styles.small}>{clean(props.rangeLabel)} · Comparaison : {clean(props.prevRangeLabel)}</Text>
          <PlatformStats platform={platform}/>
          <DailyTrend metrics={(props.metrics ?? []).filter(row=>row.platform===platform.platform)} platform={platform}/>
          <View style={styles.note}><Text style={styles.small}>{quality?`Couverture : ${quality.coverage}%. `:""}{clean(getPlatformNotes(platform.platform))}</Text></View>
        </ReportPage>
        <ReportPage props={props}>
          <Heading kicker={platformName(platform.platform)} title="Top 5 des contenus" subtitle="Les publications les plus vues du mois"/>
          <PostList posts={posts}/>
          <View style={styles.note}><Text style={styles.small}>Classement par vues ; à défaut sur ce réseau, par la mesure de visibilité indiquée. Les contenus sans cette mesure sont exclus. Cumuls disponibles à la collecte : l’âge et une éventuelle promotion peuvent influencer les résultats.</Text></View>
        </ReportPage>
      </React.Fragment>;
    })}
  </Document>;
}
