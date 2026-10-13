'use client';
import {ArrowUpRight} from 'lucide-react';
import {buildContentIntelligence} from '@/lib/content-intelligence';
import {reviewNumber as n,reviewPostViews,type ReviewPost} from '@/lib/monthly-review';
import {PLATFORM_LABELS} from '@/lib/types';
import {PostImage} from './post-preview';
export function ContentShowcase({posts,onOpen,onExplore}:{posts:ReviewPost[];onOpen:(post:ReviewPost)=>void;onExplore:()=>void}) {
  // One measured reference per account; avoid a cross-network competition.
  const picks=buildContentIntelligence(posts).flatMap(account=>account.top.length?[{post:account.top[0],unit:account.unit}]:[]);
  if(!picks.length)return null;
  return <section className="content-showcase"><header className="review-section-title"><div><p className="review-eyebrow">Votre production en images</p><h3>Les publications à regarder</h3><p>La publication la plus visible de chaque compte, parmi les mesures disponibles.</p></div><button className="review-text-button" onClick={onExplore}>Tous les contenus <ArrowUpRight size={16}/></button></header><div className="showcase-rail">{picks.map(({post,unit})=><button className="showcase-post" key={post.id} onClick={()=>onOpen(post)}><span className="showcase-image"><PostImage key={post.id} post={post}/><span className="showcase-platform">{PLATFORM_LABELS[post.platform]} · {post.format}</span></span><span className="showcase-result"><strong>{n(unit==='vues'?reviewPostViews(post):post.visibilityDetails?.find(d=>d.label==='Impressions')?.value??post.visibility)}</strong><small>{unit} à la collecte</small><ArrowUpRight size={19}/></span><span className="showcase-caption">{post.caption||'Publication sans légende'}</span></button>)}</div></section>;
}
