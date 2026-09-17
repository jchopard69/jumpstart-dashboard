import 'server-only';
import { createSupabaseServiceClient } from './supabase/server';

/** Fail closed: only registered users with current tenant access may receive its data. */
export async function getReportRecipients(tenantId: string, configured?: string[]): Promise<string[]> {
  const db=createSupabaseServiceClient();
  const [{data:tenant,error:tenantError},{data:access,error:accessError},{data:direct,error:directError}]=await Promise.all([
    db.from('tenants').select('is_active,is_demo').eq('id',tenantId).single(),
    db.from('user_tenant_access').select('user_id').eq('tenant_id',tenantId),
    db.from('profiles').select('id,email,role').eq('tenant_id',tenantId),
  ]);
  if(tenantError||accessError||directError) throw new Error('Impossible de vérifier les accès des destinataires.');
  if(!tenant?.is_active||tenant.is_demo) return [];
  let profiles=direct??[];
  if(access?.length){const {data,error}=await db.from('profiles').select('id,email,role').in('id',access.map(a=>a.user_id));if(error)throw new Error('Impossible de vérifier les destinataires.');profiles=[...profiles,...(data??[])];}
  let admins: string[]=[];
  if(configured?.length){
    const {data,error}=await db.from('profiles').select('email').eq('role','agency_admin').in('email',configured.map(email=>email.trim().toLowerCase()));
    if(error)throw new Error('Impossible de vérifier les destinataires agence.');
    admins=(data??[]).map(profile=>profile.email.toLowerCase());
  }
  const allowed=new Set(profiles.filter(p=>p.role!=='agency_admin'&&p.email).map(p=>p.email.trim().toLowerCase()));
  for(const email of admins)allowed.add(email);
  return [...new Set((configured??[...allowed]).map(email=>email.trim().toLowerCase()))].filter(email=>allowed.has(email)&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}
