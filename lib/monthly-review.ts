import type { MeasuredFields } from "./measurement";
import { postPreviewCandidates } from "./post-preview";
import { PLATFORM_LABELS, type Platform } from './types';
import { getPostVisibilityDetails, type PostVisibilityDetail, getPostVisibility, getPostEngagements, hasPostEngagementMeasurement } from './metrics';

export type ReviewMetric = 'views' | 'engagements' | 'followers' | 'posts_count';
export const REVIEW_LABELS: Record<ReviewMetric, string> = { views: 'Vues', engagements: 'Interactions', followers: 'Abonnés', posts_count: 'Publications' };
export type ReviewTotals = Record<ReviewMetric, number> & { reach: number; impressions?: number; watch_time?: number };
export type ReviewChannel = { platform: Platform; totals: ReviewTotals; prevTotals?: ReviewTotals; available: { views: boolean; reach: boolean; engagements: boolean }; measured?: MeasuredFields; previousMeasured?: MeasuredFields; hasCurrent: boolean; hasPrevious: boolean; coverage: number; previousCoverage: number };
export type ReviewPost = { id: string; platform: Platform; accountId: string; caption: string; date: string; format: string; thumbnail: string | null; previewCandidates?: string[]; url: string | null; visibility: number | null; visibilityLabel: string; visibilityDetails?: PostVisibilityDetail[]; engagements: number | null; likes: number | null; comments: number | null; shares: number | null; saves: number | null };
export type ReviewRow = { date: string; platform?: string | null; social_account_id?: string | null; views: number | null; engagements: number | null; followers: number | null; reach: number | null };
export type MetricChange = { current: number | null; previous: number | null; difference: number | null; percent: number | null };
export const reviewNumber = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
export function metricChange(current: number | null, previous: number | null): MetricChange {
  const difference = current != null && previous != null ? current - previous : null;
  return { current, previous, difference, percent: difference != null && previous != null && previous > 0 ? difference / previous * 100 : null };
}
export function channelChange(channel: ReviewChannel, metric: ReviewMetric): MetricChange {
  const available = metric !== 'views' && metric !== 'engagements' || channel.available[metric];
  return metricChange(available && (metric === 'posts_count' || (channel.hasCurrent && channel.measured?.[metric] !== false)) ? channel.totals[metric] : null,
    available && channel.prevTotals && (metric === 'posts_count' || (channel.hasPrevious && channel.previousMeasured?.[metric] !== false)) ? channel.prevTotals[metric] : null);
}
export function buildDrivers(channels: ReviewChannel[], metric: ReviewMetric) {
  return channels.map(channel => ({ platform: channel.platform, label: PLATFORM_LABELS[channel.platform], coverage: channel.coverage, previousCoverage: channel.previousCoverage, ...channelChange(channel, metric) }))
    .sort((a, b) => Math.abs(b.difference ?? 0) - Math.abs(a.difference ?? 0));
}
export function readPostMetric(metrics: Record<string, unknown> | null | undefined, keys: string[]): number | null {
  for (const key of keys) {
    const value = metrics?.[key];
    if (value == null || value === '' || typeof value === 'boolean') continue;
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}
export function normalizeReviewPost(post: { id: string; platform?: string | null; social_account_id?: string | null; caption?: string | null; posted_at?: string | null; media_type?: string | null; thumbnail_url?: string | null; media_url?: string | null; url?: string | null; metrics?: Record<string, unknown> | null }): ReviewPost {
  const v = getPostVisibility(post.metrics, post.media_type, post.platform);
  const rawFormat = (post.media_type ?? '').toLowerCase();
  const format = /reel/.test(rawFormat) ? 'Reel' : /video/.test(rawFormat) ? 'Vidéo' : /carousel|album/.test(rawFormat) ? 'Carrousel' : /image|photo/.test(rawFormat) ? 'Image' : /text/.test(rawFormat) ? 'Texte' : 'Autre';
  const safe = (url?: string | null) => url && /^https?:\/\//i.test(url) ? url : null;
  return { id: post.id, platform: (post.platform ?? 'instagram') as Platform, accountId: post.social_account_id ?? '', caption: (post.caption ?? '').normalize('NFKC'), date: post.posted_at ?? '', format, thumbnail: postPreviewCandidates(post)[0] ?? null, previewCandidates: [...postPreviewCandidates(post), ...(/^[a-f0-9-]{36}$/i.test(post.id) && format !== 'Texte' ? [`/api/client/posts/${post.id}/preview`] : [])], url: safe(post.url), visibility: v.value > 0 ? v.value : null, visibilityLabel: v.label, visibilityDetails: getPostVisibilityDetails(post.metrics), engagements: hasPostEngagementMeasurement(post.metrics) ? getPostEngagements(post.metrics) : null,
    likes: readPostMetric(post.metrics, ['likes','like_count']), comments: readPostMetric(post.metrics, ['comments','comments_count','comment_count']), shares: readPostMetric(post.metrics, ['shares','share_count','reposts','repost_count']), saves: readPostMetric(post.metrics, ['saves','save_count','saved']) };
}
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b) => a-b); const m = Math.floor(sorted.length/2);
  return sorted.length % 2 ? sorted[m] : (sorted[m-1]+sorted[m])/2;
}
export function formatBenchmarks(posts: ReviewPost[]) {
  const groups = new Map<string, ReviewPost[]>();
  for (const p of posts) { const key = `${p.platform}:${p.format}`; groups.set(key, [...(groups.get(key) ?? []), p]); }
  return [...groups.values()].map(group => ({ platform: group[0].platform, format: group[0].format, count: group.length, measured: group.filter(p=>p.engagements!=null).length, median: median(group.flatMap(p=>p.engagements==null?[]:[p.engagements])) }));
}
/** Only actual view metrics participate in view rankings. */
export function reviewPostViews(post: ReviewPost): number | null {
  const measured = post.visibilityDetails?.find(item => item.label === 'Vues');
  return measured?.value ?? (post.visibilityLabel === 'Vues' ? post.visibility : null);
}
export function filterReviewPosts(posts: ReviewPost[], query: string, platform: string, format: string, sort: string) {
  const normalize = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const matches = posts.filter(p => (platform === 'all' || p.platform === platform) && (format === 'all' || p.format === format) && normalize(p.caption).includes(normalize(query)));
  const value = (post: ReviewPost): number | null => {
    if (sort === 'views' || sort === 'views_asc') return reviewPostViews(post);
    if (sort === 'visibility') return post.visibility;
    if (sort === 'comments' || sort === 'shares' || sort === 'saves') return post[sort];
    return post.engagements;
  };
  return matches.sort((a,b) => {
    if (sort === 'date') return b.date.localeCompare(a.date);
    const av = value(a), bv = value(b);
    if (av == null || bv == null) return av == null && bv == null ? b.date.localeCompare(a.date) : av == null ? 1 : -1;
    return (sort === 'views_asc' ? av-bv : bv-av) || b.date.localeCompare(a.date);
  });
}
export function comparisonIssue(posts: ReviewPost[]): string | null {
  if (posts.length < 2) return 'Sélectionnez au moins deux contenus.';
  if (new Set(posts.map(p=>p.platform)).size > 1) return 'Comparez des contenus d’un même réseau : les interactions ne sont pas définies de la même façon partout.';
  if (posts.some(p=>!p.accountId)) return 'Le compte de ces contenus doit être identifié avant de les comparer.';
  if (new Set(posts.map(p=>p.accountId)).size > 1) return 'Comparez des contenus du même compte pour conserver le même périmètre d’audience.';
  return null;
}
export function extraChannelMetrics(channel: ReviewChannel) {
  return [
    {label:'Portée cumulée',value:channel.available.reach && channel.totals.reach>0?channel.totals.reach:null,previous:channel.prevTotals?.reach??null},
    {label:'Impressions',value:(channel.totals.impressions??0)>0?channel.totals.impressions!:null,previous:channel.prevTotals?.impressions??null},
    {label:'Minutes regardées',value:channel.platform==='youtube'&&(channel.totals.watch_time??0)>0?channel.totals.watch_time!:null,previous:channel.prevTotals?.watch_time??null},
  ].filter(item=>item.value!==null);
}
