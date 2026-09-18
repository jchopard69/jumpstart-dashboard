import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';
import { resolveSocialImage } from '@/lib/social-image';
import { checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(_request: Request, { params }: { params: { postId: string } }) {
  const session = createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return new Response(null, { status: 401 });
  if (!/^[a-f0-9-]{36}$/i.test(params.postId)) return new Response(null, { status: 404 });
  const { data: profile } = await session.from('profiles').select('role,tenant_id').eq('id',user.id).single();
  if (!profile) return new Response(null, { status: 403 });
  // Explicit tenant authorization before using credentials or downloading any image.
  const service = createSupabaseServiceClient();
  const { data: post } = await service.from('social_posts').select('id,tenant_id,social_account_id,external_post_id,platform,thumbnail_url,media_url,media_type').eq('id',params.postId).maybeSingle();
  if (!post) return new Response(null, { status: 404 });
  if (profile.role !== 'agency_admin' && profile.tenant_id !== post.tenant_id) {
    const { data: access } = await session.from('user_tenant_access').select('tenant_id').eq('user_id',user.id).eq('tenant_id',post.tenant_id).maybeSingle();
    if (!access) return new Response(null, { status: 404 });
  }
  if (!checkRateLimit(`preview:${user.id}`, { max: 240, windowMs: 60000 }).allowed) return new Response(null, { status: 429 });
  const image = await resolveSocialImage(post);
  if (!image) return new Response(null, { status: 404, headers: { 'Cache-Control': 'private, max-age=60' } });
  return new Response(new Uint8Array(image.bytes), { headers: { 'Content-Type': image.type, 'Cache-Control': 'private, max-age=1800', 'X-Content-Type-Options': 'nosniff' } });
}
