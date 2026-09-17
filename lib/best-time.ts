/** Observed publishing windows, using one measured metric and one network at a time. */
import { getPostEngagements, getPostVisibility, hasPostEngagementMeasurement } from "./metrics";

export type TimeSlot = { day: number; hour: number; avgVisibility: number; postCount: number; intensity: number };
export type BestTimeData = {
  accountId?: string; accountName?: string;
  slots: TimeSlot[]; bestDay: string; bestHour: string; totalPostsAnalyzed: number;
  platforms: string[]; metricLabel: string; timeZone: string; bestSlotCount: number;
};
const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const HOUR_LABELS = ["0h–6h", "6h–9h", "9h–12h", "12h–14h", "14h–17h", "17h–20h", "20h–24h"];
const HOUR_RANGES: [number, number][] = [[0,6],[6,9],[9,12],[12,14],[14,17],[17,20],[20,24]];

export function analyzeBestTime(posts: Array<{
  posted_at?: string | null; metrics?: Record<string, unknown> | null;
  media_type?: string | null; platform?: string | null;
}>, platformFilter?: string): BestTimeData | null {
  const filtered = posts.filter(p => p.posted_at && Number.isFinite(new Date(p.posted_at).getTime()) &&
    (!platformFilter || platformFilter === "all" || p.platform === platformFilter));
  const platforms = [...new Set(filtered.map(p => p.platform).filter(Boolean) as string[])];
  // Aggregating different networks would rank their audience sizes rather than publishing windows.
  if (platforms.length !== 1) return null;
  const visibilityGroups = new Map<string, {post: typeof filtered[number]; value: number}[]>();
  for (const post of filtered) {
    const visibility = getPostVisibility(post.metrics, post.media_type);
    if (visibility.value > 0) visibilityGroups.set(visibility.label, [...(visibilityGroups.get(visibility.label) ?? []), {post, value: visibility.value}]);
  }
  const visibility = [...visibilityGroups.entries()].sort((a,b) => b[1].length-a[1].length)[0];
  const interactions = filtered.filter(p => hasPostEngagementMeasurement(p.metrics)).map(post => ({post, value: getPostEngagements(post.metrics)}));
  const useVisibility = visibility && visibility[1].length >= 5 && visibility[1].length >= interactions.length;
  const measured = useVisibility ? visibility[1] : interactions;
  const metricLabel = useVisibility ? visibility[0] : "Interactions";
  if (measured.length < 5) return null;
  const timeZone = "Europe/Paris";
  const formatter = new Intl.DateTimeFormat("en-GB", {timeZone, weekday:"short", hour:"numeric", hourCycle:"h23"});
  const weekdays = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const grid = new Map<string, {total:number; count:number}>();
  for (const {post,value} of measured) {
    const parts = formatter.formatToParts(new Date(post.posted_at!));
    const day = weekdays.indexOf(parts.find(p=>p.type==='weekday')!.value);
    const hour = Number(parts.find(p=>p.type==='hour')!.value);
    const slot = HOUR_RANGES.findIndex(([start,end]) => hour>=start && hour<end);
    const key = `${day}-${slot}`; const prior=grid.get(key) ?? {total:0,count:0};
    grid.set(key,{total:prior.total+value,count:prior.count+1});
  }
  if (grid.size < 3) return null;
  const slots: TimeSlot[] = [];
  for (let day=0;day<7;day++) for(let hour=0;hour<HOUR_RANGES.length;hour++) {
    const value=grid.get(`${day}-${hour}`);
    slots.push({day,hour,avgVisibility:value?value.total/value.count:0,postCount:value?.count??0,intensity:0});
  }
  const max = Math.max(...slots.map(s=>s.avgVisibility));
  if (max <= 0) return null;
  for (const slot of slots) slot.intensity=slot.avgVisibility/max;
  const best=[...slots].filter(s=>s.postCount>0).sort((a,b)=>b.avgVisibility-a.avgVisibility||b.postCount-a.postCount)[0];
  return {slots,bestDay:DAY_LABELS[best.day],bestHour:HOUR_LABELS[best.hour],totalPostsAnalyzed:measured.length,platforms,metricLabel,timeZone,bestSlotCount:best.postCount};
}
export { DAY_LABELS, HOUR_LABELS };

/** Keep account audiences separate even when they use the same network. */
export function analyzeAccountBestTimes(
  posts: Array<Parameters<typeof analyzeBestTime>[0][number] & { social_account_id?: string | null }>,
  accounts: Array<{id:string;platform:string;account_name?:string|null}>
): BestTimeData[] {
  return accounts.flatMap(account=>{
    const result=analyzeBestTime(posts.filter(post=>post.social_account_id===account.id),account.platform);
    return result?[{...result,accountId:account.id,accountName:account.account_name??account.platform}]:[];
  });
}
