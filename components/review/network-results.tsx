'use client';
import {ArrowUpRight,Facebook,Instagram,Linkedin,Music2,Youtube,Globe} from 'lucide-react';
import {youtubeDepth} from '@/lib/content-impact';
import {channelChange,metricChange,reviewNumber as n,type ReviewChannel} from '@/lib/monthly-review';
import {PLATFORM_LABELS,type Platform} from '@/lib/types';
const icons={facebook:Facebook,instagram:Instagram,linkedin:Linkedin,tiktok:Music2,youtube:Youtube,twitter:Globe};
export function NetworkMark({platform}:{platform:Platform}) {const Icon=icons[platform];return <span className={`network-mark network-${platform}`}><Icon size={20} aria-hidden="true"/></span>;}
function Evolution({value}:{value:number|null}) {return <small className={value==null?'network-neutral':value<0?'network-down':'network-up'}>{value==null?'Comparaison indisponible':`${value>0?'+':''}${n(Math.round(value*10)/10)}% vs précédent`}</small>;}
export function NetworkResults({channels,onExplore}:{channels:ReviewChannel[];onExplore:(network:string)=>void}) {
  return <section className="network-results"><header className="review-section-title"><div><p className="review-eyebrow">Vos réseaux</p><h3>Chaque réseau, son résultat.</h3><p>Statistiques des comptes pendant la période sélectionnée.</p></div></header><div className="network-list">{channels.map(channel=>{
    const views=channelChange(channel,'views');const engagement=channelChange(channel,'engagements');const followers=channelChange(channel,'followers');
    const impressions=channel.hasCurrent&&channel.totals.impressions!=null&&channel.totals.impressions>0?channel.totals.impressions:null;
    const visibility=views.current!=null?views:metricChange(impressions,channel.hasPrevious&&channel.prevTotals?.impressions!=null&&channel.prevTotals.impressions>0?channel.prevTotals.impressions:null);
    const depth=youtubeDepth(channel);
    return <article key={channel.platform} className="network-result"><div className="network-identity"><NetworkMark platform={channel.platform}/><div><h4>{PLATFORM_LABELS[channel.platform]}</h4><small>{channel.totals.posts_count} publications</small></div></div><div className="network-result-metric network-visibility"><span>{views.current!=null?'Vues':impressions!=null?'Impressions':'Visibilité'}</span><strong>{n(visibility.current)}</strong><Evolution value={channel.coverage>=90&&channel.previousCoverage>=90?visibility.percent:null}/></div><div className="network-result-metric"><span>Interactions</span><strong>{n(engagement.current)}</strong><Evolution value={channel.coverage>=90&&channel.previousCoverage>=90?engagement.percent:null}/></div><div className="network-result-metric"><span>Communauté</span><strong>{n(followers.current)}</strong><small>{followers.difference==null?'Évolution indisponible':`${followers.difference>0?'+':''}${n(followers.difference)} abonnés`}</small></div><button className="network-open" onClick={()=>onExplore(channel.platform)} aria-label={`Explorer les contenus ${PLATFORM_LABELS[channel.platform]}`}><ArrowUpRight size={20}/></button>
      {depth&&<div className="network-depth"><div><span>Temps de visionnage YouTube</span><strong>{n(Math.round(depth.minutes/60))} h</strong><small>{n(depth.minutes)} minutes · {channel.coverage}% de collecte</small></div><div><span>Temps moyen par vue calculé</span><strong>{n(Math.round(depth.secondsPerView))} s</strong><small>{depth.previousSecondsPerView!=null?`${n(Math.round(depth.previousSecondsPerView))} s sur la période précédente`:'Période précédente non comparable'}</small></div><p>Minutes regardées ÷ vues, sur la même période. Le mix Shorts / vidéos longues peut faire varier ce résultat ; il ne mesure pas le pourcentage de rétention.</p></div>}
      {channel.coverage<90&&<small className="network-coverage">Collecte partielle : {channel.coverage}% des relevés attendus.</small>}
    </article>;
  })}</div></section>;
}
