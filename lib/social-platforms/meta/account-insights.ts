import type {DailyMetric} from '../core/types';
export type AccountResponse={data?:{name:string;total_value?:{value:unknown};values?:{value:unknown}[]}[]};
export type AccountRequest=(day:string,metrics:string[])=>Promise<AccountResponse>;
export const IG_DAILY_VERSION=1;
export function instagramDates(now=Date.now(),existing:Record<string,number>={}) {
  const end=new Date(now);end.setUTCHours(0,0,0,0);
  const days:string[]=[];
  for(let back=89;back>=1;back--){const day=new Date(end.getTime()-back*86400000).toISOString().slice(0,10);if(existing[day]!==IG_DAILY_VERSION||back<=7)days.push(day);}
  return days;
}
/** A total_value is requested for precisely one day. Never distribute a period total. */
export async function collectInstagramDay(day:string,request:AccountRequest):Promise<DailyMetric> {
  let response:AccountResponse;
  try {response=await request(day,['views','reach','total_interactions']);}
  catch(error){
    const message=error instanceof Error?error.message:String(error);
    if(!/valid insights metric|invalid parameter|not supported|nonexisting field|no longer supported|2108006/i.test(message))throw error;
    response=await request(day,['views']);
  }
  const values:Record<string,number>={};
  for(const item of response.data??[]){const value=item.total_value?.value??item.values?.[0]?.value;if(typeof value==='number'&&Number.isFinite(value)&&value>=0)values[item.name]=value;}
  if(values.views==null)throw new Error(`Vues Instagram non fournies pour le ${day}`);
  return {date:day,views:values.views,reach:values.reach,engagements:values.total_interactions,
    raw_json:{_ig_daily_views_version:IG_DAILY_VERSION,_ig_collected_at:new Date().toISOString(),_ig_source:'account_insights_24h',...values}};
}
export async function collectInstagramDays(days:string[],request:AccountRequest) {
  const rows:DailyMetric[]=[];const failed:string[]=[];const issues:{day:string;message:string}[]=[];let cursor=0;
  await Promise.all(Array.from({length:Math.min(4,days.length)},async()=>{while(cursor<days.length){const day=days[cursor++];try{rows.push(await collectInstagramDay(day,request));}catch(error){failed.push(day);issues.push({day,message:(error instanceof Error?error.message:'Mesure indisponible').replace(/https?:\/\/\S+/g,'[URL]').slice(0,180)});}}}));
  return {rows:rows.sort((a,b)=>a.date.localeCompare(b.date)),failed,issues};
}
