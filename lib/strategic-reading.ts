import { editorialProposal } from "./editorial-advice";
import { median, reviewNumber, type ReviewPost } from './monthly-review';
import type { Platform } from './types';

export type StrategicSignal = { platform: Platform; title: string; observation: string; interpretation: string; action: string; measure: string; limitation: string; postId: string; url: string | null; format?: string; angle?: string; steps?: string[] };
/** Evidence first: no advice is emitted without a named publication and a measured peer group. */
export function buildStrategicReading(posts: ReviewPost[]): StrategicSignal[] {
  const signals: StrategicSignal[]=[];
  const networks=[...new Set(posts.map(p=>p.platform))];
  for(const platform of networks) {
    const pool=posts.filter(p=>p.platform===platform);
    const keys: ('saves'|'shares'|'comments'|'engagements')[]=platform==='instagram'?['saves','shares','comments','engagements']:platform==='linkedin'?['comments','shares','engagements']:['shares','comments','engagements'];
    const used=new Set<string>();
    for(const key of keys) {
      if(signals.filter(s=>s.platform===platform).length>=1)break;
      const minimum=key==='engagements'?10:3;
      const candidates=pool.filter(p=>p.accountId&&p[key]!=null&&p[key]!>=minimum&&!used.has(p.id)).sort((a,b)=>(b[key]??0)-(a[key]??0));
      for(const top of candidates) {
        const peers=pool.filter(p=>p.accountId===top.accountId&&p.format===top.format&&p[key]!=null);
        if(peers.length<3)continue;
        const baseline=median(peers.map(p=>p[key]!))!;
        if(top[key]!<=baseline*1.25 || top[key]!-baseline<(key==='engagements'?5:2))continue;
        const label={saves:'enregistrements',shares:'partages',comments:'commentaires',engagements:'interactions'}[key];
        const proposal=editorialProposal(top);
        signals.push({platform,title:proposal.title,format:proposal.format,angle:proposal.angle,steps:proposal.steps,
          observation:`« ${proposal.reference} » a obtenu ${reviewNumber(top[key])} ${label}. C’est davantage que le résultat habituel des ${peers.length} contenus du même format sur ce compte (${reviewNumber(baseline)}, valeur médiane).`,
          interpretation:`Ce sujet mérite une nouvelle déclinaison. Le résultat observé porte sur les ${label} ; il ne suffit pas à conclure que ce contenu a généré des ventes.`,
          action:`À partir de « ${proposal.reference} » : ${proposal.format}. ${proposal.angle} ${proposal.steps.join(' ')}`,
          measure:`Après publication, relever les ${label} à 7 jours puis à 30 jours. Comparer à des contenus du même compte, en séparant les publications sponsorisées.`,
          limitation:'Proposition de contenu à préparer avec JumpStart, à partir d’une publication mesurée. Le résultat futur n’est pas garanti.',postId:top.id,url:top.url});
        used.add(top.id);break;
      }
    }
  }
  return signals;
}
