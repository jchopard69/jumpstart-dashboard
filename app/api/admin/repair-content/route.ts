import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';
import { getValidAccessToken } from '@/lib/social-platforms/core/token-manager';
import { collectPostInsights, mergeMetaPostMetrics } from '@/lib/social-platforms/meta/post-insights';
import { META_CONFIG } from '@/lib/social-platforms/meta/config';
import { refreshMetaMedia, resolveSocialImage } from '@/lib/social-image';
import { checkRateLimit } from '@/lib/rate-limit';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';
const uuid = /^[a-f0-9-]{36}$/i;

/** Cursor batches include historical posts, not only the first API page or last 90 days. */
export async function POST(request: Request) {
  const session = createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });
  const { data: profile } = await session.from('profiles').select('role').eq('id',user.id).single();
  if (profile?.role !== 'agency_admin') return NextResponse.json({ error: 'Accès administrateur requis.' }, { status: 403 });
  if (!checkRateLimit(`repair:${user.id}`,{max:60,windowMs:60000}).allowed) return NextResponse.json({error:'Réessayez dans une minute.'},{status:429});
  const body = await request.json().catch(() => null);
  if (!body || !uuid.test(body.tenantId ?? '') || (body.cursor && !uuid.test(body.cursor))) return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 });
  const db = createSupabaseServiceClient();
  const { data: tenant, error: tenantError } = await db.from('tenants').select('id,is_demo,is_active').eq('id',body.tenantId).single();
  if (tenantError || !tenant || tenant.is_demo || !tenant.is_active) return NextResponse.json({error:'Client indisponible.'},{status:403});
  const { data: accounts, error: accountError } = await db.from('social_accounts').select('id,auth_status,platform').eq('tenant_id',tenant.id);
  if (accountError) return NextResponse.json({error:'Lecture des comptes impossible.'},{status:503});
  let query = db.from('social_posts').select('id,tenant_id,social_account_id,external_post_id,platform,thumbnail_url,media_url,media_type,metrics').eq('tenant_id',tenant.id).order('id').limit(9);
  if (body.cursor) query = query.gt('id',body.cursor);
  const { data: rows, error } = await query;
  if (error) return NextResponse.json({error:'Lecture des contenus impossible.'},{status:503});
  const posts = (rows ?? []).slice(0,8);
  const tokens = new Map<string, Promise<string | null>>();
  const results: {id:string;platform:string;views:boolean;preview:string;issue:string|null}[] = [];
  let next = 0;
  await Promise.all(Array.from({length:Math.min(4,posts.length)},async()=>{
    while(next<posts.length) {
      const post = posts[next++];
      const isMeta = post.platform === 'instagram' || post.platform === 'facebook';
      let metrics = post.metrics as Record<string, unknown> ?? {};
      let issue: string | null = null;
      let current = post;
      try {
        if (isMeta) {
          const account = accounts?.find(a=>a.id===post.social_account_id);
          if (account?.auth_status !== 'active') throw new Error('Compte à reconnecter');
          if (!tokens.has(account.id)) tokens.set(account.id,getValidAccessToken(account.id));
          const token = await tokens.get(account.id);
          if (!token) throw new Error('Compte à reconnecter');
          const fresh = await refreshMetaMedia(post,token);
          if (fresh) current = {...post,...fresh};
          const collected = await collectPostInsights(post.platform,async names=>{
            const url = new URL(`${META_CONFIG.graphUrl}/${encodeURIComponent(post.external_post_id)}/insights`);
            url.searchParams.set('metric',names.join(','));
            if (post.platform==='facebook') url.searchParams.set('period','lifetime');
            const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000),cache:'no-store'});
            const payload=await response.json();
            if (!response.ok) {
              issue = payload.error?.code === 190 ? 'Compte à reconnecter' : payload.error?.code === 4 || payload.error?.code === 613 ? 'Limite API atteinte' : 'Mesure non fournie par Meta';
              throw new Error(payload.error?.message ?? 'Meta request failed');
            }
            return payload;
          });
          // Re-read before merging so a concurrent daily sync is not overwritten with an old snapshot.
          const {data: latest,error: latestError}=await db.from('social_posts').select('metrics').eq('id',post.id).eq('tenant_id',tenant.id).single();
          if(latestError)throw new Error('Lecture des mesures impossible');
          metrics=mergeMetaPostMetrics(post.platform,{...collected,_visibility_checked_at:Date.now()},latest?.metrics??metrics);
          if(collected.views !== undefined)issue=null;
          else issue ??= 'Mesure non fournie par Meta';
          const {error: saveError}=await db.from('social_posts').update({metrics}).eq('id',post.id).eq('tenant_id',tenant.id);
          if(saveError)throw new Error('Enregistrement impossible');
        }
        const image = current.media_type === 'text' ? null : await resolveSocialImage(current);
        results.push({id:post.id,platform:post.platform,views:typeof metrics.views==='number' && (Number(metrics.views)>0||!!metrics._views_collected_at),preview:current.media_type==='text'?'sans visuel':image?'disponible':'indisponible',issue});
      } catch {
        results.push({id:post.id,platform:post.platform,views:typeof metrics.views==='number'&&Number(metrics.views)>0,preview:'non vérifié',issue:issue??'Collecte interrompue ou compte à reconnecter'});
      }
    }
  }));
  return NextResponse.json({results,nextCursor:(rows?.length??0)>8?posts.at(-1)?.id:null,checked:posts.length});
}
