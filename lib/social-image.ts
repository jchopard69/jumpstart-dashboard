import 'server-only';
import { postPreviewCandidates } from './post-preview';
import { META_CONFIG } from './social-platforms/meta/config';
import { metaPostMedia, META_POST_MEDIA_FIELDS, type MetaPostMedia } from './social-platforms/meta/post-media';

export type ImagePost = { id?: string; tenant_id?: string; social_account_id?: string; external_post_id?: string;
  platform?: string | null; thumbnail_url?: string | null; media_url?: string | null; media_type?: string | null };

// Only image hosts used by the connected networks. Validate every redirect too.
export function isSocialImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ['fbcdn.net','cdninstagram.com','fbsbx.com','licdn.com','licdn-ei.com','ytimg.com','tiktokcdn.com','tiktokcdn-us.com','tiktokcdn-eu.com','byteoversea.com','ibytedtos.com','muscdn.com','unsplash.com','pexels.com']
        .some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch { return false; }
}

export async function downloadSocialImage(initial: string): Promise<{ bytes: Buffer; type: string } | null> {
  let url = initial;
  try {
    for (let redirects = 0; redirects < 4; redirects++) {
      if (!isSocialImageUrl(url)) return null;
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(5000), cache: 'no-store', headers: { Accept: 'image/jpeg,image/png,image/webp' } });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) return null;
        url = new URL(location, url).href;
        continue;
      }
      if (!response.ok || Number(response.headers.get('content-length')) > 8 * 1024 * 1024) { await response.body?.cancel(); return null; }
      const reader = response.body?.getReader();
      if (!reader) return null;
      let length = 0; const chunks: Uint8Array[] = [];
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        length += value.length;
        if (length > 8 * 1024 * 1024) { await reader.cancel(); return null; }
        chunks.push(value);
      }
      const bytes = Buffer.concat(chunks);
      const type = bytes[0] === 255 && bytes[1] === 216 ? 'image/jpeg'
        : bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png'
        : bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP' ? 'image/webp'
        : /^GIF8[79]a/.test(bytes.toString('ascii',0,6)) ? 'image/gif' : null;
      return type ? { bytes, type } : null;
    }
  } catch { /* Expired links are repaired below. */ }
  return null;
}

export async function refreshMetaMedia(post: ImagePost, token?: string) {
  if (!post.id || !post.tenant_id || !post.social_account_id || !post.external_post_id || !['instagram','facebook'].includes(post.platform ?? '')) return null;
  const { createSupabaseServiceClient } = await import('./supabase/server');
  const { getValidAccessToken } = await import('./social-platforms/core/token-manager');
  const db = createSupabaseServiceClient();
  const { data: account } = await db.from('social_accounts').select('id').eq('id',post.social_account_id).eq('tenant_id',post.tenant_id).eq('platform',post.platform).eq('auth_status','active').maybeSingle();
  if (!account) return null;
  const accessToken = token ?? await getValidAccessToken(post.social_account_id);
  if (!accessToken) return null;
  const platform = post.platform as 'instagram' | 'facebook';
  const url = new URL(`${META_CONFIG.graphUrl}/${encodeURIComponent(post.external_post_id)}`);
  url.searchParams.set('fields', META_POST_MEDIA_FIELDS[platform]);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(8000), cache: 'no-store' });
  if (!response.ok) return null;
  const media = metaPostMedia(platform, await response.json() as MetaPostMedia);
  if (media.thumbnail_url) {
    const { error } = await db.from('social_posts').update(media).eq('id',post.id).eq('tenant_id',post.tenant_id).eq('social_account_id',post.social_account_id);
    if (error) throw new Error('Preview persistence failed');
  }
  return media;
}

export async function resolveSocialImage(post: ImagePost) {
  for (const url of postPreviewCandidates(post)) {
    const image = await downloadSocialImage(url); if (image) return image;
  }
  try {
    const fresh = ['facebook','instagram'].includes(post.platform ?? '') ? await refreshMetaMedia(post) : await refreshOtherMedia(post);
    if (fresh) for (const url of postPreviewCandidates(fresh)) {
      const image = await downloadSocialImage(url); if (image) return image;
    }
  } catch { /* The UI keeps an explicit unavailable state, never a fabricated image. */ }
  return null;
}

async function refreshOtherMedia(post: ImagePost) {
  if (!post.id || !post.tenant_id || !post.social_account_id || !post.external_post_id || !['linkedin','tiktok'].includes(post.platform ?? '')) return null;
  const { createSupabaseServiceClient } = await import('./supabase/server');
  const { getValidAccessToken } = await import('./social-platforms/core/token-manager');
  const db = createSupabaseServiceClient();
  const {data: account} = await db.from('social_accounts').select('id').eq('id',post.social_account_id).eq('tenant_id',post.tenant_id).eq('platform',post.platform).eq('auth_status','active').maybeSingle();
  if(!account)return null;
  const token=await getValidAccessToken(account.id);
  if(!token)return null;
  let thumbnail: string | undefined;
  if(post.platform==='tiktok') {
    const response=await fetch('https://open.tiktokapis.com/v2/video/query/?fields=id,cover_image_url',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({filters:{video_ids:[post.external_post_id]}}),signal:AbortSignal.timeout(8000),cache:'no-store'});
    if(!response.ok)return null;
    const payload=await response.json();
    thumbnail=payload.data?.videos?.find((v:{id:string})=>v.id===post.external_post_id)?.cover_image_url;
  } else {
    const {getLinkedInVersion}=await import('./social-platforms/linkedin/config');
    const headers={Authorization:`Bearer ${token}`,'X-Restli-Protocol-Version':'2.0.0','LinkedIn-Version':getLinkedInVersion()};
    const response=await fetch(`https://api.linkedin.com/rest/posts/${encodeURIComponent(post.external_post_id)}`,{headers,signal:AbortSignal.timeout(8000),cache:'no-store'});
    if(!response.ok)return null;
    const payload=await response.json();
    const content=payload.content;
    const media=content?.media?.id ?? content?.multiImage?.images?.[0]?.id ?? content?.article?.thumbnail;
    if(typeof media==='string' && /^urn:li:(image|video):/.test(media)) {
      const isVideo=media.startsWith('urn:li:video:');
      const asset=await fetch(`https://api.linkedin.com/rest/${isVideo?'videos':'images'}/${encodeURIComponent(media)}`,{headers,signal:AbortSignal.timeout(8000),cache:'no-store'});
      if(!asset.ok)return null;
      const value=await asset.json();
      thumbnail=isVideo?value.thumbnail:value.downloadUrl;
    }
  }
  if(typeof thumbnail!=='string'||!isSocialImageUrl(thumbnail))return null;
  const {error}=await db.from('social_posts').update({thumbnail_url:thumbnail}).eq('id',post.id).eq('tenant_id',post.tenant_id);
  if(error)throw new Error('Preview persistence failed');
  return {thumbnail_url:thumbnail};
}
