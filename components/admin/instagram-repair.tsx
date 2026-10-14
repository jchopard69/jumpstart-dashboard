'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
type Account={id:string;tenant_id:string;name:string;account_name:string};
export function InstagramRepair() {
 const router=useRouter();const [accounts,setAccounts]=useState<Account[]>([]);const [client,setClient]=useState('all');const [month,setMonth]=useState(()=>{const d=new Date();d.setUTCMonth(d.getUTCMonth()-1,1);return d.toISOString().slice(0,7);});
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 async function load() {try{const r=await fetch('/api/admin/instagram-insights');const data=await r.json();if(!r.ok)throw Error(data.error);setAccounts(data.accounts);}catch{setMessage('Liste des comptes indisponible.');}}
 async function repair() {
  setBusy(true);setMessage('Collecte en cours…');let done=0;let unavailable=0;let views=0;
  try{
   const from=new Date(month+'-01T00:00:00Z');const end=new Date(from);end.setUTCMonth(end.getUTCMonth()+1);
   const earliest=new Date(Date.now()-89*86400000).toISOString().slice(0,10);const today=new Date().toISOString().slice(0,10);const days:string[]=[];
   for(let d=new Date(from);d<end;d.setUTCDate(d.getUTCDate()+1)){const day=d.toISOString().slice(0,10);if(day>=earliest&&day<today)days.push(day);}
   if(!days.length)throw Error('Ce mois ne contient aucun jour terminé accessible dans les 89 derniers jours.');
   const scope=accounts.filter(a=>client==='all'||a.tenant_id===client);if(!scope.length)throw Error('Aucun compte dans ce périmètre.');
   for(const account of scope){for(let offset=0;offset<days.length;offset+=3){
    const batch=days.slice(offset,offset+3);const r=await fetch('/api/admin/instagram-insights',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountId:account.id,days:batch})});const data=await r.json();
    if(!r.ok){unavailable+=days.length-offset;setMessage(`${account.name} : ${data.error}. Suite des autres comptes.`);break;}
    done+=data.collected;unavailable+=data.failed.length;views+=data.views;setMessage(`${account.name} · ${done} jours collectés · ${unavailable} non fournis · ${views.toLocaleString('fr-FR')} vues récupérées`);
   }}
   setMessage(`Terminé : ${scope.length} comptes · ${done} jours collectés · ${unavailable} non fournis · ${views.toLocaleString('fr-FR')} vues récupérées.`);router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:'Collecte interrompue.');}finally{setBusy(false);}
 }
 return <details className="admin-maintenance" onToggle={e=>{if(e.currentTarget.open&&!accounts.length)void load();}}><summary>Reprendre les statistiques Instagram de tous les clients</summary><div className="space-y-4 py-5"><p>Relevés journaliers du compte : vues, portée et interactions si Meta les fournit. Les jours indisponibles ne remplacent pas l’historique par des zéros.</p><div className="flex flex-wrap gap-3"><select aria-label="Client Instagram à reprendre" disabled={busy} value={client} onChange={e=>setClient(e.target.value)} className="rounded border p-2"><option value="all">Tous les clients Instagram</option>{[...new Map(accounts.map(a=>[a.tenant_id,a])).values()].map(a=><option key={a.tenant_id} value={a.tenant_id}>{a.name}</option>)}</select><input type="month" aria-label="Mois Instagram à reprendre" value={month} disabled={busy} onChange={e=>setMonth(e.target.value)} className="rounded border p-2"/><button type="button" className="review-primary" disabled={busy||!accounts.length} onClick={repair}>{busy?'Collecte en cours…':'Recollecter Instagram'}</button></div><p role="status">{message}</p><p className="text-xs text-muted-foreground">Gardez cette page ouverte jusqu’à la fin. Les jours déjà enregistrés restent sauvegardés si la collecte est interrompue.</p></div></details>;
}
