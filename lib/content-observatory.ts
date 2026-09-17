import { median, type ReviewPost } from './monthly-review';

/** Publication dates are displayed in the same timezone as publishing advice. */
export function publicationDay(value: string): string | null {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}

export function buildContentObservatory(posts: ReviewPost[]) {
  const accounts = new Map<string, ReviewPost[]>();
  for (const post of posts) {
    // Without an account identifier, separate publications cannot form a reliable cohort.
    if (!post.accountId) continue;
    const key = `${post.platform}:${post.accountId}`;
    accounts.set(key, [...(accounts.get(key) ?? []), post]);
  }
  return [...accounts.entries()].map(([key, items]) => {
    const measured = items.filter(p => p.engagements != null).sort((a,b) => b.engagements! - a.engagements!);
    const total = measured.reduce((sum,p) => sum + p.engagements!, 0);
    const topCount = Math.max(1, Math.ceil(measured.length * .2));
    const topShare = measured.length >= 5 && total > 0 ? measured.slice(0,topCount).reduce((sum,p) => sum + p.engagements!,0) / total * 100 : null;
    const formats = [...new Set(items.map(p => p.format))].map(format => {
      const group = items.filter(p => p.format === format);
      const values = (metric: 'engagements'|'comments'|'shares'|'saves') => group.flatMap(p => p[metric] == null ? [] : [p[metric]!]);
      const stats = (metric: 'engagements'|'comments'|'shares'|'saves') => ({ count: values(metric).length, median: values(metric).length >= 3 ? median(values(metric)) : null });
      return { format, count: group.length, engagements: stats('engagements'), comments: stats('comments'), shares: stats('shares'), saves: stats('saves') };
    }).sort((a,b) => (b.engagements.median ?? -1) - (a.engagements.median ?? -1));
    return { key, platform: items[0].platform, accountId: items[0].accountId, count: items.length, measured: measured.length, topCount, topShare, formats, activeDays: new Set(items.map(p=>publicationDay(p.date)).filter(Boolean)).size };
  });
}
export type ContentObservatory = ReturnType<typeof buildContentObservatory>;

export function buildPublicationCalendar(posts: ReviewPost[], from: string, to: string) {
  const start = new Date(`${from}T12:00:00Z`), end = new Date(`${to}T12:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return [];
  const counts = new Map<string, number>();
  for (const post of posts) { const day=publicationDay(post.date); if(day) counts.set(day,(counts.get(day)??0)+1); }
  const days: {date:string;count:number;weekday:number}[]=[];
  for (const d=new Date(start);d<=end && days.length<370;d.setUTCDate(d.getUTCDate()+1)) {
    const date=d.toISOString().slice(0,10);days.push({date,count:counts.get(date)??0,weekday:(d.getUTCDay()+6)%7});
  }
  return days;
}

/** Format suggestions require two measured cohorts within one account. */
export function buildFormatAdvice(posts: ReviewPost[]) {
  return buildContentObservatory(posts).flatMap(account=>{
    const keys=('instagram'===account.platform?['saves','shares','engagements']:'linkedin'===account.platform?['comments','shares','engagements']:['shares','comments','engagements']) as ('saves'|'shares'|'comments'|'engagements')[];
    for(const key of keys) {
      const measured=account.formats.filter(f=>f[key].median!=null).sort((a,b)=>b[key].median!-a[key].median!);
      if(measured.length<2)continue;
      const best=measured[0],other=measured[1];
      if(best[key].median!<=0 || best[key].median!<=other[key].median!*1.25)continue;
      const label={saves:'enregistrements',shares:'partages',comments:'commentaires',engagements:'interactions'}[key];
      return [{key:account.key,platform:account.platform,title:`${best.format} : une piste pour le prochain brief`,proof:`Sur ce compte, la médiane est de ${best[key].median} ${label} pour ${best[key].count} contenus au format ${best.format.toLowerCase()}, contre ${other[key].median} pour ${other[key].count} contenus au format ${other.format.toLowerCase()}.`,action:`Lors du prochain point éditorial, choisissez un sujet déjà traité en ${other.format.toLowerCase()} et préparez une déclinaison en ${best.format.toLowerCase()}. Gardez le même objectif pour comparer les ${label} à ancienneté et diffusion similaires avant de modifier durablement la répartition des formats.`,postId:posts.filter(p=>p.accountId===account.accountId&&p.platform===account.platform&&p.format===best.format&&p[key]!=null).sort((a,b)=>b[key]!-a[key]!)[0]?.id}];
    }
    return [];
  });
}
