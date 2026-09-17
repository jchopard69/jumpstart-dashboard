import { getSessionProfile, requireAdmin } from '@/lib/auth';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getReportRecipients } from '@/lib/report-recipients';
import { computeNextSendAt } from '@/lib/report-send-time';
import { revalidatePath } from 'next/cache';

export default async function MonthlyReportsAdmin() {
  const profile=await getSessionProfile();requireAdmin(profile);
  const db=createSupabaseServiceClient();
  const {data:tenants,error}=await db.from('tenants').select('id,name').eq('is_active',true).eq('is_demo',false).order('name');
  if(error) throw new Error('Impossible de charger les clients.');
  const ready=Boolean(process.env.RESEND_API_KEY && process.env.CRON_SECRET);
  const rows=await Promise.all((tenants??[]).map(async tenant=>{
    const {data:schedules,error}=await db.from('report_schedules').select('id,recipients,is_active,next_send_at,last_sent_at,processing_started_at').eq('tenant_id',tenant.id).eq('frequency','monthly').order('created_at');
    if(error) throw new Error('Impossible de charger les programmations.');
    const configured=(schedules??[]).flatMap(s=>s.recipients??[]);
    const recipients=await getReportRecipients(tenant.id,configured.length?configured:undefined);
    const {data:events}=await db.from('notifications').select('id,title,message,created_at').eq('tenant_id',tenant.id).ilike('title','%rapport%').order('created_at',{ascending:false}).limit(3);
    return {...tenant,recipients,schedules:schedules??[],events:events??[]};
  }));
  async function activate(form:FormData) {
    'use server';
    const actor=await getSessionProfile();requireAdmin(actor);
    if(!process.env.RESEND_API_KEY || !process.env.CRON_SECRET) throw new Error('Le service email ou la planification ne sont pas configurés.');
    const tenantId=String(form.get('tenantId')??'');
    const client=createSupabaseServiceClient();
    const {data:schedules,error}=await client.from('report_schedules').select('id,recipients,is_active,processing_started_at').eq('tenant_id',tenantId).eq('frequency','monthly').order('created_at');
    if(error)throw new Error('Lecture des programmations impossible.');
    if(schedules?.some(s=>s.processing_started_at))throw new Error('Un envoi est en cours. Réessayez après sa fin.');
    const configured=(schedules??[]).flatMap(s=>s.recipients??[]);
    const recipients=await getReportRecipients(tenantId,configured.length?configured:undefined);
    if(!recipients.length)throw new Error('Aucun destinataire avec accès valide.');
    if((schedules??[]).length>1)throw new Error('Plusieurs programmations existent : regroupez-les dans la page Rapports du client avant activation.');
    const values={frequency:'monthly',recipients,is_active:true,next_send_at:computeNextSendAt('monthly'),updated_at:new Date().toISOString()};
    const result=schedules?.length?await client.from('report_schedules').update(values).eq('id',schedules[0].id).eq('tenant_id',tenantId):await client.from('report_schedules').insert({...values,tenant_id:tenantId,created_by:actor.id});
    if(result.error)throw new Error('Activation impossible.');
    revalidatePath('/admin/reports');revalidatePath('/client/reports');
  }
  return <div className="review-app"><header className="review-header"><p className="review-eyebrow">Administration · rapports</p><h1>Les bilans mensuels<span className="review-title-caption">Le 3 de chaque mois dans la matinée, heure de Paris.</span></h1></header><section className="review-panel"><p className={ready?"review-small":"review-notice"}>{ready?"Clé email et secret de planification présents. Le domaine expéditeur et la livraison ne sont pas vérifiés par cet écran.":"Activation indisponible : le service email ou le secret de planification manque dans l’environnement de production."}</p><p>Les destinataires déjà configurés sont conservés lorsqu’ils ont toujours accès au client. Sans programmation existante, les utilisateurs clients ayant accès à l’espace sont proposés. L’activation ne déclenche aucun email immédiat.</p><p className="review-small mt-3">Expéditeur : {process.env.RESEND_FROM || "JumpStart Studio <reports@jumpstartstudio.fr>"}. Une acceptation par Resend ne prouve pas la réception. <a href="https://resend.com/emails" target="_blank" rel="noreferrer" className="review-text-button">Vérifier les livraisons dans Resend →</a></p><div className="review-table-scroll mt-6"><table><thead><tr><th>Client</th><th>Destinataires autorisés</th><th>Prochain envoi</th><th>État / dernière acceptation</th><th>Action</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><th>{row.name}</th><td>{row.recipients.join(', ')||'Aucun destinataire avec accès valide'}</td><td>{row.schedules.find(s=>s.is_active)?.next_send_at?new Date(row.schedules.find(s=>s.is_active)!.next_send_at).toLocaleDateString('fr-FR',{timeZone:'Europe/Paris'})+' · matinée':'Non programmé'}</td><td>{row.schedules.some(s=>s.processing_started_at)?"Traitement en cours":row.schedules.some(s=>s.is_active&&s.next_send_at&&Date.parse(s.next_send_at)<Date.now()-86400000)?"Échéance dépassée · à vérifier":row.schedules.some(s=>s.is_active)?"Programmé":"Non programmé"}<small className="block">{row.schedules.some(s=>s.last_sent_at)?new Date(row.schedules.filter(s=>s.last_sent_at).map(s=>s.last_sent_at!).sort().at(-1)!).toLocaleString("fr-FR",{timeZone:"Europe/Paris"}):"Aucune acceptation enregistrée"}</small><a className="review-text-button" href={`/client/reports?tenantId=${row.id}`}>Gérer ce rapport →</a>{row.events.length>0&&<details className="mt-2"><summary>Derniers événements</summary>{row.events.map(event=><p key={event.id} className="review-small mt-2"><strong>{event.title}</strong><br/>{new Date(event.created_at).toLocaleString("fr-FR",{timeZone:"Europe/Paris"})}<br/>{event.message}</p>)}</details>}</td><td><form action={activate}><input type="hidden" name="tenantId" value={row.id}/><button className="review-primary" disabled={!ready||!row.recipients.length||row.schedules.length>1||row.schedules.some(s=>s.is_active)}>{row.schedules.some(s=>s.is_active)?'Programmation active':'Activer le bilan mensuel'}</button></form>{row.schedules.length>1&&<small>Plusieurs programmations à regrouper.</small>}</td></tr>)}</tbody></table></div></section></div>;
}
export const dynamic='force-dynamic';
