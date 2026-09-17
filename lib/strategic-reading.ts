import { median, reviewNumber, type ReviewPost } from './monthly-review';
import type { Platform } from './types';

export type StrategicSignal = { platform: Platform; title: string; observation: string; interpretation: string; action: string; measure: string; limitation: string; postId: string; url: string | null };
/** Evidence first: no advice is emitted without a named publication and a measured peer group. */
export function buildStrategicReading(posts: ReviewPost[]): StrategicSignal[] {
  const signals: StrategicSignal[]=[];
  const networks=[...new Set(posts.map(p=>p.platform))];
  for(const platform of networks) {
    const pool=posts.filter(p=>p.platform===platform);
    const keys: ('saves'|'shares'|'comments'|'engagements')[]=platform==='instagram'?['saves','shares','comments','engagements']:platform==='linkedin'?['comments','shares','engagements']:['shares','comments','engagements'];
    const used=new Set<string>();
    for(const key of keys) {
      if(signals.filter(s=>s.platform===platform).length>=2)break;
      const candidates=pool.filter(p=>p[key]!=null&&p[key]!>0&&!used.has(p.id)).sort((a,b)=>(b[key]??0)-(a[key]??0));
      for(const top of candidates) {
        const peers=pool.filter(p=>p.accountId===top.accountId&&p.format===top.format&&p[key]!=null);
        if(peers.length<3)continue;
        const baseline=median(peers.map(p=>p[key]!))!;
        if(top[key]!<=baseline)continue;
        const label={saves:'enregistrements',shares:'partages',comments:'commentaires',engagements:'interactions'}[key];
        const excerpt=top.caption.replace(/\s+/g,' ').slice(0,110)||'Publication sans légende';
        const specific=key==='saves'
          ? {title:'Un contenu à décliner en ressource',interpretation:'Les enregistrements indiquent une action de conservation. Ils ne prouvent pas une intention d’achat.',action:`À partir de « ${excerpt} », préparez une suite pratique au même format : étapes, erreurs à éviter ou réponses utiles. Conservez le sujet de départ.`,measure:'Comparer les enregistrements des prochaines déclinaisons à âge de publication et diffusion comparables.'}
          : key==='shares'
          ? {title:'Un sujet qui circule',interpretation:'Ce contenu est davantage relayé que la médiane de ses pairs. Le compteur ne renseigne pas sur les raisons du partage.',action:`Réexaminez « ${excerpt} » avec l’équipe : isolez l’information que l’on peut transmettre à un collègue ou à un proche, puis approfondissez ce point dans une prochaine publication ${platform==='linkedin'?'avec un exemple métier':platform==='facebook'?'avec un exemple concret de terrain':'au même format'}.`,measure:'Suivre les partages de la déclinaison, avec une exposition et un âge comparables ; examiner aussi les commentaires.'}
          : key==='comments'
          ? {title:platform==='linkedin'?'Une conversation métier à poursuivre':'Une conversation à approfondir',interpretation:'Le volume de commentaires distingue ce contenu ; leur tonalité et leur qualité doivent être lues dans le réseau.',action:`Ouvrez « ${excerpt} », répondez aux questions encore ouvertes et retenez une question récurrente pour ${platform==='linkedin'?'une publication d’expertise avec un exemple client anonymisé':'une réponse dédiée en contenu'}. Ne déduisez pas la satisfaction du seul compteur.`,measure:'Relire les nouvelles questions et suivre les commentaires sur la réponse publiée, sans les assimiler à des prospects.'}
          : {title:'Un contenu de référence pour le prochain brief',interpretation:'Le total d’interactions dépasse la médiane du même compte et du même format. La diffusion payante et l’ancienneté peuvent contribuer à cet écart.',action:`Prenez « ${excerpt} » comme référence de brief. Identifiez avec l’agence le sujet précis, la première image ou les premières secondes, puis retenez une seule de ces caractéristiques pour une nouvelle déclinaison.`,measure:'Comparer les interactions au sein du même réseau, à durée de collecte, format et diffusion comparables.'};
        signals.push({platform,...specific,observation:`« ${excerpt} » : ${reviewNumber(top[key])} ${label}, contre une médiane de ${reviewNumber(baseline)} sur ${peers.length} publications ${top.format.toLowerCase()} du même compte.`,limitation:'Signal descriptif sur les cumuls collectés. Ni causalité démontrée ni prédiction de l’algorithme.',postId:top.id,url:top.url});
        used.add(top.id);break;
      }
    }
  }
  return signals;
}
