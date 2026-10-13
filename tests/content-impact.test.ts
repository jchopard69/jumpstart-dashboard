import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildContentImpact,youtubeDepth} from '../lib/content-impact';
import {normalizeReviewPost,type ReviewPost,type ReviewChannel} from '../lib/monthly-review';
const now=Date.parse('2026-10-13T12:00:00Z');
const post=(id:string,views:number|null,shares:number|null,accountId='a'):ReviewPost=>({id,accountId,platform:'instagram',date:'2026-09-10',format:'Reel',caption:'Contenu réel',thumbnail:null,url:null,visibility:views,visibilityLabel:'Vues',engagements:null,likes:null,comments:null,shares,saves:null});
test('ratios use the same post denominator, remain within accounts and require three eligible measures',()=>{
 const posts=[post('a',1000,10),post('b',2000,10),post('c',4000,10),post('small',20,10),post('other',1000,999,'b')];
 const result=buildContentImpact(posts,now);assert.equal(result.length,2);const action=result[0].actions[0];assert.equal(action.median,5);assert.equal(action.sample,3);assert.equal(action.total,40);assert.equal(action.reference?.post.id,'a');assert.equal(result[1].actions[0].median,null);
});
test('missing, zero-only fallback fields and young posts cannot create recommendations',()=>{
 assert.equal(buildContentImpact([post('a',1000,0),post('b',1000,null)],now)[0].actions.length,0);
 const young=[1,2,3].map(i=>({...post(String(i),1000,10),date:'2026-10-12'}));assert.equal(buildContentImpact(young,now)[0].actions[0].reference,null);
});
test('LinkedIn clicks are exposed without being called website visits',()=>{
 const normalized=normalizeReviewPost({id:'a',platform:'linkedin',social_account_id:'b',posted_at:'2026-09-10',metrics:{impressions:2000,clicks:40}});assert.equal(normalized.clicks,40);
 const posts=[1,2,3].map(i=>({...normalized,id:String(i)}));const action=buildContentImpact(posts,now)[0].actions.find(a=>a.key==='clicks');assert.equal(action?.median,20);
});
const channel:ReviewChannel={platform:'youtube',hasCurrent:true,hasPrevious:true,coverage:100,previousCoverage:100,available:{views:true,reach:false,engagements:true},totals:{views:1000,watch_time:500,engagements:10,followers:100,reach:0,posts_count:3},prevTotals:{views:500,watch_time:100,engagements:10,followers:100,reach:0,posts_count:3}};
test('YouTube depth uses minutes and period views; incomplete comparisons stay absent',()=>{
 const result=youtubeDepth(channel)!;assert.equal(result.secondsPerView,30);assert.equal(result.previousSecondsPerView,12);
 assert.equal(youtubeDepth({...channel,previousCoverage:50})?.previousSecondsPerView,null);
 assert.equal(youtubeDepth({...channel,totals:{...channel.totals,watch_time:0}}),null);
 assert.equal(youtubeDepth({...channel,platform:'instagram'}),null);
});
