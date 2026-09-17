/** Only stored image URLs; a video or a social permalink is never an image fallback. */
export function postPreviewCandidates(post: {thumbnail_url?:string|null;media_url?:string|null;media_type?:string|null}): string[] {
  const urls: string[]=[];
  const valid=(value?:string|null)=>{
    if(!value)return false;
    try {const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&!/\.(mp4|mov|webm)(?:$|[?#])/i.test(value);}catch{return false;}
  };
  if(valid(post.thumbnail_url))urls.push(post.thumbnail_url!);
  const isImage=/^(image|photo|carousel_album|carousel|album)$/i.test(post.media_type??'') || /\.(jpg|jpeg|png|webp)(?:$|[?#])/i.test(post.media_url??'');
  if(isImage && valid(post.media_url) && !urls.includes(post.media_url!))urls.push(post.media_url!);
  return urls;
}
