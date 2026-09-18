'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

type Client = { id: string; name: string };
type Exception = {id:string;platform:string;url:string|null;preview:string;issue:string|null};
type Result = { exceptions?: Exception[]; checked: number; meta: number; views: number; previews: number; unavailable: number; issues: number; done: boolean };
type Progress = { index: number; cursor: string | null; results: Record<string, Result> };
const initial = (): Progress => ({index:0,cursor:null,results:{}});

export function ContentRepair({ clients, userId }: { clients: Client[]; userId: string }) {
  const [progress,setProgress]=useState<Progress>(initial);
  const [running,setRunning]=useState(false);
  const [message,setMessage]=useState('');
  const stop=useRef(false);
  const storageKey=`content-repair-v1:${userId}:${clients.map(c=>c.id).join(',')}`;
  useEffect(()=>{try {const saved=localStorage.getItem(storageKey); if(saved){const p=JSON.parse(saved);if(Number.isInteger(p.index)&&p.index>=0&&p.index<=clients.length&&p.results)setProgress(p);}}catch{}},[storageKey,clients.length]);
  const run=async()=>{
    if(running)return;
    stop.current=false;setRunning(true);setMessage('');
    let state=progress.index>=clients.length?initial():progress;
    try {
      while(state.index<clients.length && !stop.current){
        const client=clients[state.index];
        const response=await fetch('/api/admin/repair-content',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantId:client.id,cursor:state.cursor}),signal:AbortSignal.timeout(290000)});
        const data=await response.json();
        if(!response.ok)throw new Error(data.error??'La reprise a été interrompue. Vous pouvez la relancer.');
        const total={...(state.results[client.id]??{checked:0,meta:0,views:0,previews:0,unavailable:0,issues:0,done:false})};
        for(const row of data.results){total.checked++;if(['instagram','facebook'].includes(row.platform)){total.meta++;if(row.views)total.views++;}if(row.preview==='disponible')total.previews++;if(row.preview==='indisponible')total.unavailable++;if(row.issue)total.issues++;if(row.issue || ['indisponible','non vérifié'].includes(row.preview))total.exceptions=[...(total.exceptions??[]),{id:row.id,platform:row.platform,url:row.url,preview:row.preview,issue:row.issue}].slice(0,50);}
        total.done=!data.nextCursor;
        state={index:state.index+(total.done?1:0),cursor:data.nextCursor,results:{...state.results,[client.id]:total}};
        setProgress(state);localStorage.setItem(storageKey,JSON.stringify(state));
      }
      setMessage(state.index>=clients.length?'Vérification terminée. Les éventuelles indisponibilités restent indiquées ci-dessous.':'En pause. Vous pouvez reprendre au dernier lot terminé.');
    }catch(error){setMessage(error instanceof Error?error.message:'Collecte interrompue.');}
    finally{setRunning(false);}
  };
  return <section className="surface-panel p-6 space-y-4">
    <div><p className="section-label">Fiabilité des contenus</p><h2 className="text-xl font-semibold">Reprendre les vues et les miniatures</h2>
    <p className="mt-2 text-sm text-muted-foreground">Vérifie tous les contenus déjà enregistrés, client par client, y compris l’historique. Récupère les mesures Meta et renouvelle les miniatures accessibles. Les données absentes ne sont jamais remplacées par un zéro.</p></div>
    <div className="flex flex-wrap items-center gap-3"><Button onClick={run} disabled={running||!clients.length}>{running?`Vérification : ${clients[progress.index]?.name??'terminée'}`:progress.index>=clients.length?'Relancer la vérification':progress.index>0||progress.cursor?'Reprendre la vérification':'Vérifier tous les clients'}</Button>
    {running&&<Button variant="outline" onClick={()=>{stop.current=true;setMessage('Pause après le lot en cours…');}}>Mettre en pause</Button>}
    <span className="text-sm">{progress.index} / {clients.length} clients parcourus</span></div>
    <p className="text-sm text-muted-foreground" role="status">{message||'Gardez cet onglet ouvert pendant la reprise. La progression est sauvegardée après chaque lot.'}</p>
    {Object.keys(progress.results).length>0&&<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Client</th><th className="p-2">Contenus vérifiés</th><th className="p-2">Vues Meta</th><th className="p-2">Miniatures chargées</th><th className="p-2">Miniatures indisponibles</th><th className="p-2">À vérifier</th></tr></thead><tbody>{clients.filter(c=>progress.results[c.id]).map(c=>{const r=progress.results[c.id];return <tr key={c.id} className="border-t"><th className="p-2 font-medium">{c.name}{!r.done?' · en cours':''}</th><td className="p-2">{r.checked}</td><td className="p-2">{r.views} / {r.meta}</td><td className="p-2">{r.previews}</td><td className="p-2">{r.unavailable}</td><td className="p-2">{r.issues}</td></tr>;})}</tbody></table></div>}
    {clients.filter(c=>progress.results[c.id]?.exceptions?.length).map(c=><details key={c.id} className="rounded-xl border p-3 text-sm"><summary className="cursor-pointer font-medium">{c.name} · détails des indisponibilités</summary><ul className="mt-3 space-y-2">{progress.results[c.id].exceptions!.map(row=><li key={row.id}>{row.platform} · {row.issue??`Miniature ${row.preview}`} {row.url && /^https:\/\//.test(row.url) ? <a className="underline" href={row.url} target="_blank" rel="noreferrer">Voir la publication</a> : <span>({row.id})</span>}</li>)}</ul><p className="mt-2 text-muted-foreground">Jusqu’à 50 exemples par client. Une publication supprimée ou une autorisation manquante peut empêcher la récupération.</p></details>)}
  </section>;
}
