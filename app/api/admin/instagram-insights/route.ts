import {NextResponse} from 'next/server';
import {createSupabaseServerClient,createSupabaseServiceClient} from '@/lib/supabase/server';
import {getValidAccessToken} from '@/lib/social-platforms/core/token-manager';
import {META_CONFIG} from '@/lib/social-platforms/meta/config';
import {collectInstagramDays} from '@/lib/social-platforms/meta/account-insights';
import {apiRequest,buildUrl} from '@/lib/social-platforms/core/api-client';
export const maxDuration=60;
export const dynamic='force-dynamic';
async function authorized() {
 const session=createSupabaseServerClient();const {data:{user}}=await session.auth.getUser();
 if(!user)return false;const {data:profile}=await session.from('profiles').select('role').eq('id',user.id).single();return profile?.role==='agency_admin';
}
export async function GET() {
 if(!await authorized())return NextResponse.json({error:'Accès administrateur requis'},{status:403});
 const db=createSupabaseServiceClient();
 const {data:tenants,error}=await db.from('tenants').select('id,name').eq('is_active',true).eq('is_demo',false);
 if(error)return NextResponse.json({error:'Lecture des clients impossible'},{status:503});
 const {data:accounts,error:accountError}=await db.from('social_accounts').select('id,tenant_id,account_name,auth_status').eq('platform','instagram').in('tenant_id',(tenants??[]).map(t=>t.id));
 if(accountError)return NextResponse.json({error:'Lecture des comptes impossible'},{status:503});
 return NextResponse.json({accounts:(accounts??[]).map(a=>({...a,name:tenants?.find(t=>t.id===a.tenant_id)?.name}))});
}
export async function POST(request:Request) {
 if(!await authorized())return NextResponse.json({error:'Accès administrateur requis'},{status:403});
 const body=await request.json().catch(()=>null);
 if(!body||!/^[a-f0-9-]{36}$/i.test(body.accountId??'')||!Array.isArray(body.days)||!body.days.length||body.days.length>3)return NextResponse.json({error:'Paramètres invalides'},{status:400});
 const today=new Date().toISOString().slice(0,10);const earliest=new Date(Date.now()-89*86400000).toISOString().slice(0,10);
 const days=[...new Set<string>(body.days)];
 if(days.some(day=>!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day||day<earliest||day>=today))return NextResponse.json({error:'Choisir des jours terminés dans les 89 derniers jours'},{status:400});
 const db=createSupabaseServiceClient();const {data:account}=await db.from('social_accounts').select('id,tenant_id,external_account_id,auth_status').eq('id',body.accountId).eq('platform','instagram').single();
 const {data:tenant}=await db.from('tenants').select('is_active,is_demo').eq('id',account?.tenant_id??'').maybeSingle();
 if(!account||!tenant?.is_active||tenant.is_demo)return NextResponse.json({error:'Compte indisponible'},{status:403});
 if(account.auth_status!=='active')return NextResponse.json({error:'Compte à reconnecter'},{status:409});
 try {
  const token=await getValidAccessToken(account.id);if(!token)throw new Error('Compte à reconnecter');
  const result=await collectInstagramDays(days,async(day,metrics)=>{
   const since=Math.floor(new Date(day+'T00:00:00Z').getTime()/1000);
   return apiRequest('instagram',buildUrl(`${META_CONFIG.graphUrl}/${account.external_account_id}/insights`,{metric:metrics.join(','),period:'day',metric_type:'total_value',since,until:since+86400,access_token:token}),{timeout:10000},`instagram_daily_repair_${account.id}`,true);
  });
  if(!result.rows.length&&result.failed.length)return NextResponse.json({error:result.issues[0]?.message??'Vues non fournies par Meta',failed:result.failed},{status:503});
  for(const row of result.rows) {
   const payload={tenant_id:account.tenant_id,social_account_id:account.id,platform:'instagram',date:row.date,views:row.views,
    ...(row.reach!=null?{reach:row.reach}:{}),...(row.engagements!=null?{engagements:row.engagements}:{}),raw_json:row.raw_json};
   const {error}=await db.from('social_daily_metrics').upsert([payload],{onConflict:'tenant_id,platform,social_account_id,date',defaultToNull:false});
   if(error)throw new Error('Enregistrement impossible');
  }
  return NextResponse.json({collected:result.rows.length,failed:result.failed,views:result.rows.reduce((sum,row)=>sum+(row.views??0),0)});
 }catch {return NextResponse.json({error:'Collecte interrompue. Historique conservé ; vérifier la connexion ou la limite Meta.'},{status:503});}
}
