'use client';

import { useMemo, useState } from 'react';
import { buildContentObservatory, buildPublicationCalendar, publicationDay } from '@/lib/content-observatory';
import { reviewNumber as n, type ReviewPost } from '@/lib/monthly-review';
import { PLATFORM_LABELS } from '@/lib/types';

export function ContentObservatory({posts,from,to,onOpen}:{posts:ReviewPost[];from:string;to:string;onOpen:(post:ReviewPost)=>void}) {
  const accounts=useMemo(()=>buildContentObservatory(posts),[posts]);
  const [selected,setSelected]=useState('all');
  const [day,setDay]=useState<string|null>(null);
  const scope=selected==='all'?posts:posts.filter(p=>`${p.platform}:${p.accountId}`===selected);
  const calendar=buildPublicationCalendar(scope,from,to);
  const accountLabel=(a:typeof accounts[number])=>`${PLATFORM_LABELS[a.platform]}${accounts.filter(b=>b.platform===a.platform).length>1?` · compte ${accounts.filter(b=>b.platform===a.platform).findIndex(b=>b.key===a.key)+1}`:''}`;
  return <div className="review-panel">
    <div className="review-section-title"><div><span className="review-eyebrow">Votre production, sous un autre angle</span><h2>Formats & cadence</h2><p>Quels formats suscitent des réactions ? Les résultats sont-ils répartis entre vos contenus ?</p></div><select aria-label="Compte à analyser" value={selected} onChange={e=>{setSelected(e.target.value);setDay(null);}}><option value="all">Tous les comptes</option>{accounts.map(a=><option key={a.key} value={a.key}>{accountLabel(a)}</option>)}</select></div>
    <p className="review-notice">Chaque comparaison reste dans le même compte et le même réseau. Les chiffres des contenus sont des cumuls à la collecte : leur âge, leur sujet et une éventuelle promotion peuvent expliquer les écarts.</p>
    {accounts.filter(a=>selected==='all'||selected===a.key).map(a=><section className="review-observatory-account" key={a.key}>
      <div className="review-section-title"><div><h3>{accountLabel(a)}</h3><p>{a.count} publications collectées · {a.activeDays} jours avec publication · {a.measured} contenus avec interactions mesurées</p></div></div>
      {a.topShare!=null&&<div className="review-concentration"><div><span className="review-eyebrow">Concentration des interactions</span><strong>{Math.round(a.topShare)} %</strong></div><p>des interactions mesurées proviennent des <b>{a.topCount} contenus les plus performants</b> sur {a.measured}. Ce groupe représente les 20 % de contenus les plus performants, arrondis au supérieur. {a.measured<a.count?'Les publications sans mesure sont exclues.':''}</p><div className="review-concentration-track" role="img" aria-label={`${Math.round(a.topShare)} pour cent des interactions`}><i style={{width:`${a.topShare}%`}}/></div></div>}
      <div className="review-table-scroll" tabIndex={0}><table><caption className="review-small">Résultat médian par publication : la moitié fait mieux, la moitié fait moins. Au moins 3 mesures requises par cellule.</caption><thead><tr><th>Format</th><th>Volume</th><th>Interactions</th><th>Commentaires</th><th>Partages</th><th>Enregistrements</th></tr></thead><tbody>{a.formats.map(f=><tr key={f.format}><th>{f.format}</th><td>{f.count}</td>{(['engagements','comments','shares','saves'] as const).map(key=><td key={key}><strong>{n(f[key].median)}</strong><small>{f[key].count}/{f.count} mesurés{f[key].count<3?' · insuffisant':''}</small></td>)}</tr>)}</tbody></table></div>
      <p className="review-small">Pour préparer le prochain brief, comparez les formats sur l’action recherchée : conversation, partage ou enregistrement. Un volume élevé de publications ne signifie pas une meilleure performance par contenu.</p>
    </section>)}
    {!accounts.length&&<p className="review-empty">Les publications rattachées à un compte permettront de comparer les formats ici.</p>}
    <section className="review-calendar-section"><div className="review-section-title"><div><h3>Le calendrier de votre présence</h3><p>Publications collectées, en heure de Paris. Sélectionnez une date pour retrouver ses contenus. Une case vide ne prouve pas l’absence de publication.</p></div></div><div className="review-calendar">{['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(label=><span className="review-calendar-weekday" key={label}>{label}</span>)}{calendar.map((d,i)=><button key={d.date} style={i===0?{gridColumnStart:d.weekday+1}:undefined} className={d.count?'has-posts':''} aria-pressed={day===d.date} onClick={()=>setDay(day===d.date?null:d.date)} aria-label={`${d.date} : ${d.count} publication${d.count>1?'s':''} collectée${d.count>1?'s':''}`}><span>{new Date(d.date+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'short',timeZone:'UTC'})}</span><b>{d.count||'—'}</b></button>)}</div>{day&&<div className="review-day-results"><h4>{new Date(day+'T12:00:00Z').toLocaleDateString('fr-FR',{dateStyle:'long',timeZone:'UTC'})}</h4>{scope.filter(p=>publicationDay(p.date)===day).map(p=><button className="review-day-post" key={p.id} onClick={()=>onOpen(p)}><span>{PLATFORM_LABELS[p.platform]} · {p.format}</span><strong>{p.caption||'Publication sans légende'}</strong><small>{n(p.engagements)} interactions →</small></button>)}{!scope.some(p=>publicationDay(p.date)===day)&&<p className="review-small">Aucune publication collectée pour cette date.</p>}</div>}</section>
  </div>;
}
