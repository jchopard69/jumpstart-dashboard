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
    const {data:schedules,error}=await db.from('report_schedules').select('id,recipients,is_active,next_send_at').eq('tenant_id',tenant.id).eq('frequency','monthly').order('created_at');
    if(error) throw new Error('Impossible de charger les programmations.');
    const configured=(schedules??[]).flatMap(s=>s.recipients??[]);
    const recipients=await getReportRecipients(tenant.id,configured.length?configured:undefined);
    return {...tenant,recipients,schedules:schedules??[]};
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
  return <div className="review-app"><header className="review-header"><p className="review-eyebrow">Administration · rapports</p><h1>Les bilans mensuels<span className="review-title-caption">Le 3 de chaque mois à 9 h, heure de Paris.</span></h1></header><section className="review-panel"><p className={ready?"review-small":"review-notice"}>{ready?"Services email et planification configurés.":"Activation indisponible : le service email ou le secret de planification manque dans l’environnement de production."}</p><p>Les destinataires déjà configurés sont conservés lorsqu’ils ont toujours accès au client. Sans programmation existante, les utilisateurs clients ayant accès à l’espace sont proposés. L’activation ne déclenche aucun email immédiat.</p><div className="review-table-scroll mt-6"><table><thead><tr><th>Client</th><th>Destinataires autorisés</th><th>Prochain envoi</th><th>Activation</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><th>{row.name}</th><td>{row.recipients.join(', ')||'Aucun destinataire avec accès valide'}</td><td>{row.schedules.find(s=>s.is_active)?.next_send_at?new Date(row.schedules.find(s=>s.is_active)!.next_send_at).toLocaleString('fr-FR',{timeZone:'Europe/Paris'}):'Non programmé'}</td><td><form action={activate}><input type="hidden" name="tenantId" value={row.id}/><button className="review-primary" disabled={!ready||!row.recipients.length||row.schedules.length>1}>{row.schedules.some(s=>s.is_active)?'Appliquer le rythme mensuel':'Activer le bilan mensuel'}</button></form>{row.schedules.length>1&&<small>Plusieurs programmations à regrouper.</small>}</td></tr>)}</tbody></table></div></section></div>;
}
export const dynamic='force-dynamic';
