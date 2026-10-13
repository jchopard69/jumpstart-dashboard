import { buildContentIntelligence } from './content-intelligence';
import { median, reviewPostViews, type ReviewPost, type ReviewChannel } from './monthly-review';
import { observedNumber } from './measurement';

export const ACTIONS = {
  shares: {label:'Partages', purpose:'Diffusion', explanation:'Les publications que votre audience relaie.'},
  saves: {label:'Enregistrements', purpose:'Utilité', explanation:'Les publications conservées pour être retrouvées.'},
  comments: {label:'Commentaires', purpose:'Conversation', explanation:'Les publications qui suscitent une réponse.'},
  clicks: {label:'Clics', purpose:'Intérêt', explanation:'Clics sur la publication LinkedIn ; pas nécessairement vers un site.'},
} as const;
export type ActionKey = keyof typeof ACTIONS;

export function buildContentImpact(posts: ReviewPost[], now=Date.now()) {
  return buildContentIntelligence(posts,now).map(account=>{
    const visibility=(post:ReviewPost)=>account.unit==='vues'?reviewPostViews(post):post.visibilityDetails?.find(d=>d.label==='Impressions')?.value??(post.visibilityLabel==='Impressions'?post.visibility:null);
    const actions=(Object.keys(ACTIONS) as ActionKey[]).filter(key=>key!=='clicks'||account.platform==='linkedin').map(key=>{
      const measured=account.posts.filter(p=>observedNumber(p[key])!=null);
      const total=measured.reduce((sum,p)=>sum+observedNumber(p[key])!,0);
      const ratios=measured.flatMap(post=>{
        const v=visibility(post);const age=now-Date.parse(post.date);
        return v!=null && v>=100 && age>=7*86400000 ? [{post,value:observedNumber(post[key])!/v*1000,visibility:v}] : [];
      });
      const typical=ratios.length>=3?median(ratios.map(r=>r.value)):null;
      const reference=typical==null?null:[...ratios].filter(r=>r.value>0).sort((a,b)=>b.value-a.value||b.visibility-a.visibility)[0]??null;
      // Zero-only fallback fields do not produce an invented recommendation.
      return {key,total:measured.length?total:null,measured:measured.length,sample:ratios.length,median:typical,reference};
    }).filter(a=>(a.total??0)>0);
    return {...account,actions};
  });
}

/** YouTube account-period minutes and views share the daily Analytics scope. */
export function youtubeDepth(channel:ReviewChannel) {
  if(channel.platform!=='youtube'||!channel.hasCurrent||channel.measured?.views===false)return null;
  const minutes=observedNumber(channel.totals.watch_time);
  const views=observedNumber(channel.totals.views);
  if(minutes==null||minutes<=0||views==null||views<=0)return null;
  const previousMinutes=channel.hasPrevious?observedNumber(channel.prevTotals?.watch_time):null;
  const previousViews=channel.hasPrevious&&channel.previousMeasured?.views!==false?observedNumber(channel.prevTotals?.views):null;
  const comparable=channel.coverage>=90&&channel.previousCoverage>=90;
  return {minutes,secondsPerView:minutes*60/views,previousMinutes:comparable&&previousMinutes!=null&&previousMinutes>0?previousMinutes:null,
    previousSecondsPerView:comparable&&previousMinutes!=null&&previousMinutes>0&&previousViews!=null&&previousViews>0?previousMinutes*60/previousViews:null};
}
