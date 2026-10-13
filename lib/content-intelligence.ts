import { median, reviewPostViews, type ReviewPost } from './monthly-review';
import type { Platform } from './types';

export type FormatEvidence = {
  format: string; count: number; measured: number; mature: number; eligible: number;
  median: number | null; age: number | null; total: number; volumeShare: number;
  visibilityShare: number | null; representative: ReviewPost | null;
};
export type AccountEvidence = {
  key: string; platform: Platform; accountId: string; unit: 'vues' | 'impressions';
  posts: ReviewPost[]; measured: number; total: number | null; topShare: number | null;
  top: ReviewPost[]; formats: FormatEvidence[];
  opportunity: {best: FormatEvidence; other: FormatEvidence; lift: number} | null;
};
const WEEK = 7 * 86400000;
const valid = (v: number | null | undefined): v is number => v != null && Number.isFinite(v) && v >= 0;

/** Published-content cumulative visibility; never combined with account-period totals. */
export function buildContentIntelligence(posts: ReviewPost[], now = Date.now()): AccountEvidence[] {
  const accounts = new Map<string, ReviewPost[]>();
  for (const post of posts) {
    // Missing account identifiers cannot support within-account comparisons.
    const key = `${post.platform}:${post.accountId || 'unknown'}`;
    accounts.set(key, [...(accounts.get(key) ?? []), post]);
  }
  return [...accounts].map(([key, group]) => {
    const first = group[0];
    const unit = group.some(p => valid(reviewPostViews(p))) ? 'vues' : 'impressions';
    const value = (p: ReviewPost): number | null => {
      const v = unit === 'vues' ? reviewPostViews(p) : p.visibilityDetails?.find(d => d.label === 'Impressions')?.value ?? (p.visibilityLabel === 'Impressions' ? p.visibility : null);
      return valid(v) ? v : null;
    };
    const age = (p: ReviewPost) => now - Date.parse(p.date);
    const measured = group.filter(p => value(p) != null);
    const total = measured.reduce((sum, p) => sum + value(p)!, 0);
    const top = [...measured].sort((a,b) => value(b)! - value(a)! || a.id.localeCompare(b.id)).slice(0,3);
    const formats = [...new Set(group.map(p => p.format))].map(format => {
      const subset = group.filter(p => p.format === format);
      const mature = subset.filter(p => Number.isFinite(age(p)) && age(p) >= WEEK);
      const eligible = mature.filter(p => value(p) != null);
      const middle = eligible.length >= 3 ? median(eligible.map(p => value(p)!)) : null;
      const sum = subset.reduce((s,p) => s + (value(p) ?? 0), 0);
      const representative = middle == null ? null : [...eligible].sort((a,b) => Math.abs(value(a)! - middle) - Math.abs(value(b)! - middle) || a.id.localeCompare(b.id))[0];
      return {format, count:subset.length, measured:subset.filter(p => value(p) != null).length,
        mature:mature.length, eligible:eligible.length, median:middle,
        age:median(eligible.map(p => age(p) / 86400000)), total:sum,
        volumeShare:subset.length/group.length*100, visibilityShare:total>0 ? sum/total*100 : null, representative};
    }).sort((a,b) => (b.median ?? -1) - (a.median ?? -1));
    const reliable = formats.filter(f => f.median != null && f.mature > 0 && f.eligible / f.mature >= .8);
    const best = reliable[0];
    const other = best && reliable.find(f => f !== best && f.median! > 0 && best.age != null && f.age != null && Math.max(best.age,f.age)/Math.min(best.age,f.age) <= 2);
    const lift = best && other ? (best.median! / other.median! - 1) * 100 : 0;
    return {key, platform:first.platform, accountId:first.accountId, unit, posts:group,
      measured:measured.length, total:measured.length ? total : null, topShare:total>0 && measured.length>=5 ? top.reduce((s,p)=>s+value(p)!,0)/total*100 : null,
      top, formats, opportunity:first.accountId && best && other && lift>=25 ? {best,other,lift} : null};
  });
}
