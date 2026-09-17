import { buildContentObservatory } from "../lib/content-observatory";
import { buildStrategicReading } from "../lib/strategic-reading";
import { normalizeReviewPost } from "../lib/monthly-review";
import { mkdir, writeFile } from "node:fs/promises";
import { renderToBuffer } from "@react-pdf/renderer";
import { PdfDocument, type PdfDocumentProps } from "../lib/pdf-document";
import { buildEditorialRoadmap } from "../lib/editorial-roadmap";

const platforms = ["instagram", "linkedin"];
const metrics = platforms.flatMap((platform, account) => Array.from({ length: 31 }, (_, i) => ({
  date: `2026-08-${String(i + 1).padStart(2, "0")}`, platform: platform as "instagram" | "linkedin",
  social_account_id: platform, followers: (account ? 3200 : 10000) + i * 20,
  views: (account ? 600 : 1200) + i * 70, reach: (account ? 400 : 900) + i * 35,
  engagements: (account ? 20 : 45) + i * 3, posts_count: [3, 9, 15, 21, 27].includes(i) ? 1 : 0,
})));
const posts = platforms.flatMap(platform => [3, 9, 15, 21, 27].map((day, i) => ({
  platform, media_type: "video", date: `${String(day + 1).padStart(2, "0")}/08/2026`,
  caption: ["Dans les coulisses du studio : une idée devient une création.", "Trois questions avant de démarrer un projet.", "Portrait d’équipe : une journée au studio.", "Du premier croquis au résultat final.", "Les rencontres de ce mois-ci."][i],
  metrics: { views: 3000 + i * 200, engagements: i === 4 ? 240 : 90 + i * 10 },
})));
const change = (current: number, previous: number) => previous > 0 ? (current - previous) / previous * 100 : 0;
const summaries = platforms.map(platform => {
  const rows = metrics.filter(row => row.platform === platform);
  const totals = { followers: rows.at(-1)!.followers, views: 0, reach: 0, engagements: 0, posts_count: 0 };
  for (const row of rows) for (const key of ["views", "reach", "engagements", "posts_count"] as const) totals[key] += row[key];
  const prevTotals = { followers: totals.followers - 600, views: Math.round(totals.views / 1.18), reach: Math.round(totals.reach / 1.11), engagements: Math.round(totals.engagements / 1.21), posts_count: 4 };
  const delta = { ...totals };
  for (const key of Object.keys(delta) as Array<keyof typeof delta>) delta[key] = change(totals[key], prevTotals[key]);
  return { platform, accountNames: [`Atelier Horizon · ${platform}`], available: { views: true, reach: true, engagements: true }, totals, prevTotals, delta };
});
const sumTotals = (previous = false) => summaries.reduce((sum, platform) => {
  const totals = previous ? platform.prevTotals : platform.totals;
  for (const key of Object.keys(sum) as Array<keyof typeof sum>) sum[key] += totals[key];
  return sum;
}, { followers: 0, views: 0, reach: 0, engagements: 0, posts_count: 0 });
const currentTotals = sumTotals();
const previousTotals = sumTotals(true);
const sample: PdfDocumentProps = {
  contentObservatory: buildContentObservatory(posts.map((p,i)=>normalizeReviewPost({id:String(i),platform:p.platform,social_account_id:p.platform,media_type:p.media_type,posted_at:`2026-08-${String(i%5*6+4).padStart(2,"0")}T10:00:00Z`,metrics:p.metrics}))),
  tenantName: "Atelier Horizon — exemple fictif",
  strategicSignals:buildStrategicReading(posts.map((p,i)=>normalizeReviewPost({...p,id:String(i),social_account_id:p.platform,posted_at:"2026-08-01T08:00:00Z"}))),
  rangeLabel: "01/08/2026 - 31/08/2026",
  prevRangeLabel: "01/07/2026 - 31/07/2026",
  generatedAt: "07/09/2026",
  watermark: "DÉMONSTRATION · DONNÉES FICTIVES",
  kpis: ["followers", "views", "reach", "engagements", "posts_count"].map((key, index) => {
    const field = key as keyof typeof currentTotals;
    return { label: ["Abonnés", "Vues", "Portée cumulée", "Interactions", "Publications"][index], value: currentTotals[field], delta: change(currentTotals[field], previousTotals[field]) };
  }),
  platforms: summaries,
  score: { global: 76, grade: "B+", summary: "Indice interne de démonstration.", subScores: [{ label: "Croissance", value: 79 }, { label: "Portée", value: 84 }, { label: "Engagement", value: 69 }, { label: "Régularité", value: 75 }, { label: "Momentum", value: 60 }] },
  executiveSummary: "L'audience et les interactions progressent dans cet exemple fictif. Les chapitres suivants permettent d'examiner les contributions de chaque canal et les contenus à étudier pour le prochain cycle.",
  postsAnalyzed: posts.length,
  posts: [...posts].sort((a, b) => b.metrics.engagements / b.metrics.views - a.metrics.engagements / a.metrics.views).map(post => ({ platform: post.platform, date: post.date, caption: post.caption,
    visibility: { label: "Vues" as const, value: post.metrics.views }, engagements: post.metrics.engagements,
    engagementRate: post.metrics.engagements / post.metrics.views * 100 })),
  metrics,
  shootDays: 2, shoots: [], documents: [],
  editorialRoadmap: buildEditorialRoadmap(posts, 100),
  dataQuality: { overallCoverage: 100, expectedDays: 31, staleSync: false, actions: [], platformQuality: platforms.map(platform => ({ platform: platform as "instagram" | "linkedin", accounts: 1, coveredDays: 31, expectedDays: 31, coverage: 100, status: "good", missingMetrics: [] })) },
};
await mkdir("output/pdf", { recursive: true });
await writeFile("output/pdf/rapport-mensuel-jumpstart-exemple.pdf", await renderToBuffer(PdfDocument(sample)));
console.log("Exemple PDF créé avec des données explicitement fictives.");
// Stress fixtures exercise page breaks independently of API/network availability.
const longCaption = 'Une réalisation détaillée, ses contraintes, les étapes et les enseignements pour le client. '.repeat(12);
const highVolume = {...sample, tenantName:'Exemple fictif — activité importante', strategicSignals:sample.strategicSignals?.map(signal=>({...signal, observation:signal.observation+' Les compteurs restent descriptifs.', steps:signal.steps?.map(step=>step+' Préparer les éléments avec l’équipe avant la production.')})), posts:Array.from({length:60},(_,i)=>({...sample.posts[i%sample.posts.length],caption:longCaption})),postsAnalyzed:60};
await writeFile('output/pdf/rapport-verification-volume.pdf',await renderToBuffer(PdfDocument(highVolume)));
const sparse = {...sample,dataQuality:{...sample.dataQuality!,overallCoverage:0,platformQuality:sample.dataQuality!.platformQuality.map(q=>({...q,coverage:0,coveredDays:0,status:'missing' as const}))},tenantName:'Exemple fictif — collecte incomplète',score:undefined,strategicSignals:[],contentObservatory:[],posts:[],postsAnalyzed:0,metrics:[],kpis:sample.kpis.map(k=>({...k,value:null,delta:null})),platforms:sample.platforms.map(p=>({...p,hasCurrentMetrics:false,hasPreviousMetrics:false,totals:{...p.totals,posts_count:0},prevTotals:{...(p.prevTotals??p.totals),posts_count:0}})),executiveSummary:'Données insuffisantes pour comparer les résultats. Aucun résultat ne peut être déduit de cette absence de collecte.'};
await writeFile('output/pdf/rapport-verification-incomplet.pdf',await renderToBuffer(PdfDocument(sparse)));
