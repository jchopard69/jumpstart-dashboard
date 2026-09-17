import { ClientSwitcher } from "@/components/admin/client-switcher";
import { Button } from "@/components/ui/button";
import { notFound } from 'next/navigation';
import { MonthlyWorkspace } from '@/components/review/monthly-workspace';
import { normalizeReviewPost } from '@/lib/monthly-review';
import { analyzeBestTime } from '@/lib/best-time';
import { computeJumpStartScore } from '@/lib/scoring';
import type { Platform } from '@/lib/types';

export default function DesignPreview() {
  if (process.env.NODE_ENV !== 'development') notFound();
  const platforms: Platform[]=['instagram','facebook','linkedin'];
  const totals={followers:15450,views:187400,reach:112300,engagements:6340,posts_count:18};
  const channels=platforms.map((platform,i)=>({platform,totals:{...totals,followers:4200+i*1300,views:72000-i*22000,engagements:3200-i*600},prevTotals:{...totals,followers:4050+i*1300,views:61000-i*23000,engagements:2900-i*500},available:{views:true,reach:platform!=='facebook',engagements:true},hasCurrent:true,hasPrevious:true,coverage:100,previousCoverage:100}));
  const rows=Array.from({length:31},(_,i)=>({date:`2026-08-${String(i+1).padStart(2,'0')}`,views:1800+(i%7)*1500,engagements:120+(i%9)*43,followers:15200+i*9,reach:1800}));
  const rawPosts=Array.from({length:24},(_,i)=>({id:`demo-${i}`,platform:platforms[i%3],social_account_id:platforms[i%3],caption:['Dans les coulisses de notre atelier : celles et ceux qui donnent vie à chaque projet.','Un nouveau regard sur notre savoir-faire. Découvrez les étapes de cette réalisation.','Rencontre avec notre équipe : un métier, une passion et un engagement quotidien.'][i%3],posted_at:`2026-08-${String(i+1).padStart(2,'0')}T${String(6+i%12).padStart(2,'0')}:00:00Z`,media_type:i%2?'VIDEO':'IMAGE',metrics:{views:1800+i*750,likes:85+i*10,comments:12+i,shares:6+i,saves:3+i,engagements:106+i*13}}));
  const score=computeJumpStartScore({...totals,postsCount:18,prevFollowers:14900,prevViews:158400,prevReach:101000,prevEngagements:5200,prevPostsCount:16,periodDays:31});
  return <main className="jumpstart-canvas min-h-screen p-4 md:p-10"><div className="mx-auto max-w-[1200px]"><aside className="jumpstart-sidebar mb-8 flex items-center justify-between gap-4 p-6"><ClientSwitcher clients={[{id:"demo",name:"Atelier Horizon",slug:"atelier-horizon",is_active:true,platforms:["instagram"],lastSyncStatus:"success",lastSyncAt:null}]} currentTenantId="demo"/><Button variant="outline" className="sidebar-signout">Déconnexion</Button></aside><MonthlyWorkspace period="1 — 31 août 2026" previousPeriod="1 — 31 juillet 2026" from="2026-08-01" to="2026-08-31" channels={channels} posts={rawPosts.map(normalizeReviewPost)} rows={rows} previousRows={rows.map(r=>({...r,date:r.date.replace('-08-','-07-'),engagements:r.engagements*.8}))} score={score} bestTimes={platforms.flatMap(p=>{const d=analyzeBestTime(rawPosts,p);return d?[d]:[];})} header={<header className="review-header"><div className="review-header-top"><div><p className="review-eyebrow">JumpStart Studio · données fictives</p><h1>Atelier Horizon<span className="review-title-caption">Votre bilan social media.</span></h1></div><button className="review-primary">Exporter le rapport PDF</button></div><div className="review-month-picker"><label>Août 2026</label><span>Comparé au mois précédent</span></div></header>} sources={<p>Données fictives de vérification visuelle, jamais publiées en production.</p>}/></div></main>;
}
export const dynamic='force-dynamic';
