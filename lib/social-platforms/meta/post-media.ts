type Attachment = { type?: string; media_type?: string; media?: { image?: { src?: string } }; subattachments?: { data?: Attachment[] } };
export type MetaPostMedia = {
  media_type?: string; media_product_type?: string; media_url?: string; thumbnail_url?: string;
  full_picture?: string; children?: { data?: MetaPostMedia[] }; attachments?: { data?: Attachment[] };
};

/** A video URL is never a thumbnail; prefer an actual cover or carousel child. */
export function metaPostMedia(platform: string, item: MetaPostMedia) {
  if (platform === 'instagram') {
    const child = item.children?.data?.find(row => row.thumbnail_url || (row.media_type === 'IMAGE' && row.media_url));
    const thumbnail = item.thumbnail_url || (item.media_type !== 'VIDEO' ? item.media_url : undefined)
      || child?.thumbnail_url || (child?.media_type === 'IMAGE' ? child.media_url : undefined);
    return { thumbnail_url: thumbnail, media_url: item.media_url,
      media_type: item.media_product_type === 'REELS' ? 'reel' : item.media_type?.toLowerCase() };
  }
  const attachment = item.attachments?.data?.[0];
  const type = attachment?.media_type ?? attachment?.type ?? '';
  const thumbnail = item.full_picture || attachment?.media?.image?.src || attachment?.subattachments?.data?.find(a => a.media?.image?.src)?.media?.image?.src;
  return { thumbnail_url: thumbnail, media_url: thumbnail,
    media_type: /video|reel/i.test(type) ? 'video' : /album|carousel/i.test(type) || attachment?.subattachments?.data?.length ? 'carousel' : thumbnail ? 'image' : 'text' };
}

export const META_POST_MEDIA_FIELDS = {
  instagram: 'media_type,media_product_type,media_url,thumbnail_url,children{media_type,media_url,thumbnail_url}',
  facebook: 'full_picture,attachments{type,media_type,media,subattachments{type,media_type,media}}',
};
