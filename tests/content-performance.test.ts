import test from 'node:test';
import assert from 'node:assert/strict';
import { assessContentPerformance } from '../lib/content-performance';
import { normalizeReviewPost, filterReviewPosts, reviewPostViews } from '../lib/monthly-review';
const now=Date.parse('2026-09-18T12:00:00Z');
const post=(id:string,views?:number,extra:Record<string,unknown>={})=>normalizeReviewPost({id,platform:'instagram',social_account_id:'account',media_type:'image',posted_at:'2026-08-15T12:00:00Z',metrics:views==null?{}:{views},...extra});
test('view sorting uses real views only and keeps missing observations last in either direction',()=>{
 const a=post('a',800),b=post('b',200),reach=post('reach',undefined,{metrics:{reach:99999}}),missing=post('missing');
 assert.equal(reviewPostViews(reach),null);
 assert.deepEqual(filterReviewPosts([reach,b,missing,a],'','all','all','views').map(p=>p.id),['a','b','reach','missing']);
 assert.deepEqual(filterReviewPosts([a,reach,b,missing],'','all','all','views_asc').map(p=>p.id),['b','a','reach','missing']);
});
test('high and low visibility use the other comparable posts as their reference',()=>{
 const items=[post('top',3000),post('normal1',1000),post('normal2',1100),post('normal3',900),post('low',200)];
 const result=assessContentPerformance(items,now);
 assert.equal(result.get('top')?.kind,'top');assert.equal(result.get('top')?.baseline,950);
 assert.equal(result.get('low')?.kind,'low');assert.equal(result.get('low')?.baseline,1050);
 assert.equal(result.get('normal1')?.kind,'typical');
});
test('recent, missing and insufficient data cannot be labelled low performing',()=>{
 const peers=[post('a',1000),post('b',1000),post('c',1000)];
 const recent=post('new',10,{posted_at:'2026-09-17T12:00:00Z'}),missing=post('missing'),lonely=post('lone',10,{social_account_id:'other'});
 const result=assessContentPerformance([...peers,recent,missing,lonely],now);
 assert.equal(result.get('new')?.kind,'recent');assert.equal(result.get('missing')?.kind,'missing');assert.equal(result.get('lone')?.kind,'insufficient');
});
test('comparison cohorts isolate account, network and format; zero baselines are not ranked',()=>{
 const low=post('low',10);
 for(const extra of [{social_account_id:'another'},{platform:'facebook'},{media_type:'reel'}]){
  const result=assessContentPerformance([low,...[1,2,3].map(i=>post(String(i),1000,extra))],now);
  assert.equal(result.get('low')?.kind,'insufficient');
 }
 const measuredZeros=[1,2,3].map(i=>post(String(i),0,{metrics:{views:0,_views_collected_at:now}}));
 assert.equal(assessContentPerformance([low,...measuredZeros],now).get('low')?.kind,'insufficient');
});
