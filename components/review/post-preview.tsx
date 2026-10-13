'use client';
import {useState} from 'react';
import {FileText} from 'lucide-react';
import type {ReviewPost} from '@/lib/monthly-review';
export function PostImage({post}:{post:ReviewPost}) {
  const [failed,setFailed]=useState<string[]>([]);
  const source=(post.previewCandidates??(post.thumbnail?[post.thumbnail]:[])).find(url=>!failed.includes(url));
  return source?<img src={source} alt={`Aperçu : ${post.caption.slice(0,80)||post.format}`} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(previous=>[...previous,source])} className="review-thumbnail"/>:<div className="review-preview-unavailable"><FileText size={24} aria-hidden="true"/><span>{post.format==='Texte'?'Publication texte':'Aperçu indisponible'}</span></div>;
}
