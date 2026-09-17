import Link from 'next/link';
import { getSessionProfile, requireAdmin } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { readAllRows } from '@/lib/paginated-read';

export default async function AdminOverviewPage() {
  requireAdmin(await getSessionProfile());
  const db=createSupabaseServiceClient();
  const [tenants,accounts,logs,schedules]=await Promise.all([
    readAllRows((from,to)=>db.from('tenants').select('id,name',{count:'exact'}).eq('is_active',true).eq('is_demo',false).order('name').range(from,to),'les clients'),
    readAllRows((from,to)=>db.from('social_accounts').select('id,tenant_id,account_name,auth_status',{count:'exact'}).order('id').range(from,to),'les connexions'),
    readAllRows((from,to)=>db.from('sync_logs').select('id,tenant_id,status,started_at',{count:'exact'}).gte('started_at',new Date(Date.now()-7*86400000).toISOString()).order('started_at',{ascending:false}).order('id').range(from,to),'les synchronisations'),
    readAllRows((from,to)=>db.from('report_schedules').select('id,tenant_id,is_active,next_send_at,last_sent_at',{count:'exact'}).order('id').range(from,to),'les rapports'),
  ]);
  const rows=tenants.map(tenant=>{
    const connected=accounts.filter(a=>a.tenant_id===tenant.id);
    const broken=connected.filter(a=>['expired','revoked'].includes(a.auth_status??''));
    const last=logs.find(log=>log.tenant_id===tenant.id);
    const stale=!last||Date.parse(last.started_at)<Date.now()-48*3600000;
    const active=schedules.filter(s=>s.tenant_id===tenant.id&&s.is_active);
    const late=active.some(s=>s.next_send_at&&Date.parse(s.next_send_at)<Date.now()-86400000);
    return {...tenant,connected,broken,last,stale,active,late,attention:broken.length>0||stale||last?.status==='failed'||late||!active.length};
  }).sort((a,b)=>Number(b.attention)-Number(a.attention)||a.name.localeCompare(b.name));
  return <div className="review-app"><header className="review-header"><p className="review-eyebrow">JumpStart Studio · Administration</p><h1>Le suivi de vos clients<span className="review-title-caption">Connexions, collecte et bilans mensuels.</span></h1></header><div className="review-panel"><div className="review-section-title"><div><h2>{rows.length} clients actifs</h2><p>{rows.filter(r=>r.attention).length} espaces à vérifier · statuts relevés à l’ouverture de cette page.</p></div><Link className="review-primary" href="/admin/reports">Gérer les rapports →</Link></div><div className="review-table-scroll" tabIndex={0}><table><thead><tr><th>Client</th><th>Connexions</th><th>Dernière collecte</th><th>Rapport automatique</th><th>Action</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><th><Link className="review-text-button" href={`/client/dashboard?tenantId=${row.id}`}>{row.name}</Link></th><td>{!row.connected.length?'Aucun compte':row.broken.length?`${row.broken.length} accès à renouveler`:`${row.connected.length} comptes enregistrés`}</td><td>{!row.last?'Aucune tentative sur 7 jours':row.last.status==='failed'?'Dernière tentative en échec':row.last.status==='success'?(row.stale?'Collecte ancienne':'Collecte réussie'):'Traitement à vérifier'}{row.last&&<small className="block">{new Date(row.last.started_at).toLocaleString('fr-FR',{timeZone:'Europe/Paris'})}</small>}</td><td>{row.late?'Échéance dépassée':row.active.length?'Programmé':'Non programmé'}<small className="block">La programmation ne confirme pas la livraison.</small></td><td><Link className="review-text-button" href={`/admin/clients/${row.id}`}>Gérer le client →</Link></td></tr>)}</tbody></table></div><p className="review-small mt-5">Les connexions enregistrées ne garantissent pas la disponibilité de chaque statistique. La couverture et les données manquantes se consultent dans Sources & méthode du bilan client.</p></div></div>;
}
export const dynamic='force-dynamic';
