import { assessContentPerformance } from './content-performance';
import { channelChange, reviewPostViews, reviewNumber, type ReviewChannel, type ReviewPost } from './monthly-review';
import { PLATFORM_LABELS, type Platform } from './types';

export type WatchSignal = {id:string;platform:Platform;kind:'coverage'|'decline'|'growth';title:string;proof:string;action:string};
export type ContentReference = {post:ReviewPost;baseline:number;difference:number;peers:number;metricLabel:string;metricValue:number;action:string;brief:string};
export function buildContentIntelligence(channels:ReviewChannel[],posts:ReviewPost[],now=Date.now()) {
  const watch:WatchSignal[]=[];
  for(const channel of channels) {
    const name=PLATFORM_LABELS[channel.platform];
    const metricLabel=channel.platform==='linkedin'?'impressions':'vues';
    if(channel.coverage<80 || !channel.hasCurrent) {
      watch.push({id:`coverage-${channel.platform}`,platform:channel.platform,kind:'coverage',title:`Vérifier la collecte ${name}`,proof:`${channel.coverage}% des relevés attendus sont présents sur la période sélectionnée.`,action:'Vérifier les sources avant de conclure à une baisse de performance.'});
      continue;
    }
    const change=channelChange(channel,'views');
    // Different coverage or absent metrics must never become a performance alert.
    if(channel.coverage<90 || channel.previousCoverage<90 || change.percent==null || change.previous==null || change.previous<1000) continue;
    if(change.percent<=-30 || change.percent>=50) {
      const down=change.percent<0;
      watch.push({id:`views-${channel.platform}`,platform:channel.platform,kind:down?'decline':'growth',title:`${name} : ${down?'moins de visibilité':'une progression à examiner'}`,proof:`${reviewNumber(change.current)} ${metricLabel} contre ${reviewNumber(change.previous)} sur la période précédente (${change.percent>0?'+':''}${reviewNumber(change.percent)}%).`,action:down?'Comparer les contenus les moins vus à vos références et vérifier le volume publié.':'Ouvrir les meilleurs contenus pour identifier ceux à décliner.'});
    }
  }
  // LinkedIn usually provides impressions. Use one unit for the network and
  // retain its name; never mix impressions into a measured views cohort.
  const linkedinImpressions = !posts.some(post=>post.platform==='linkedin' && reviewPostViews(post)!=null);
  const comparisonPosts = posts.map(post=>post.platform==='linkedin' && linkedinImpressions && post.visibilityLabel==='Impressions' ? {...post,visibilityLabel:'Vues',visibilityDetails:[{label:'Vues',value:post.visibility!}]} : post);
  const performance=assessContentPerformance(comparisonPosts,now);
  const references:ContentReference[]=[];
  // One reference per network keeps the next production focused.
  for(const platform of [...new Set(posts.map(post=>post.platform))]) {
    const candidates=posts.filter(post=>post.platform===platform && performance.get(post.id)?.kind==='top')
      .sort((a,b)=>(performance.get(b.id)?.difference??0)-(performance.get(a.id)?.difference??0));
    const post=candidates[0];if(!post)continue;
    const evidence=performance.get(post.id)!;
    const metricLabel=platform==='linkedin' && linkedinImpressions?'impressions':'vues';
    const metricValue=metricLabel==='impressions'?post.visibility!:reviewPostViews(post)!;
    const subject=post.caption.replace(/\s+/g,' ').slice(0,140)||'le sujet de cette publication';
    const action=`Décliner « ${subject} » en ${post.format.toLowerCase()}, sur le même compte. Garder le sujet et changer une seule chose : l’ouverture ou le point de vue.`;
    const brief=[`Réseau : ${PLATFORM_LABELS[platform]} · format : ${post.format}`,`Référence : ${post.caption}`,`Publication : ${post.date}`,post.url?`Source : ${post.url}`:'',`Preuve : +${Math.round(evidence.difference!)}% de ${metricLabel} par rapport à la médiane de ${evidence.peers} autres contenus du même compte et format (${reviewNumber(evidence.baseline)} ${metricLabel}).`,action,'À préparer avec JumpStart : la variante choisie, les images à réutiliser et une preuve factuelle à montrer.',`Suivi : relever les ${metricLabel} à 7 et 30 jours. Séparer la diffusion payante si connue.`,'Les cumuls, l’âge et la sponsorisation peuvent différer ; ce signal ne prouve pas la cause du résultat.'].filter(Boolean).join('\n\n');
    references.push({post,baseline:evidence.baseline!,difference:evidence.difference!,peers:evidence.peers,metricLabel,metricValue,action,brief});
  }
  return {watch:watch.sort((a,b)=>({coverage:0,decline:1,growth:2}[a.kind]-{coverage:0,decline:1,growth:2}[b.kind])),references:references.slice(0,3),pending:posts.filter(post=>performance.get(post.id)?.kind==='recent').length,missingViews:posts.filter(post=>reviewPostViews(post)==null).length};
}
