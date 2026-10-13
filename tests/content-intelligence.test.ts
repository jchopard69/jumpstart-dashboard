import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildContentIntelligence} from '../lib/content-intelligence';
import type {ReviewChannel,ReviewPost} from '../lib/monthly-review';
const now=Date.parse('2026-10-13T12:00:00Z');
function channel(overrides:Partial<ReviewChannel>={}):ReviewChannel{return {platform:'instagram',hasCurrent:true,hasPrevious:true,coverage:100,previousCoverage:100,available:{views:true,engagements:true,reach:false},totals:{views:5000,engagements:50,followers:100,posts_count:5,reach:0},prevTotals:{views:10000,engagements:50,followers:100,posts_count:5,reach:0},...overrides};}
function post(id:string,views:number|null,accountId='a',date='2026-09-01'):ReviewPost{return{id,platform:'instagram',accountId,date,format:'Reel',caption:'Montage de la structure à Reims',thumbnail:null,url:'https://example.com/'+id,visibility:views,visibilityLabel:'Vues',engagements:30,likes:25,comments:5,shares:0,saves:0};}
test('partial or missing measures create collection signals instead of performance claims',()=>{
 assert.equal(buildContentIntelligence([channel({coverage:70})],[],now).watch[0].kind,'coverage');
 for(const overrides of [{previousCoverage:50},{hasPrevious:false},{measured:{views:false,engagements:true,followers:true,reach:true}},{previousMeasured:{views:false,engagements:true,followers:true,reach:true}}])assert.equal(buildContentIntelligence([channel(overrides)],[],now).watch.length,0);
});
test('measured decline is explicit and small bases do not trigger noisy alerts',()=>{
 const alert=buildContentIntelligence([channel()],[],now).watch[0];assert.equal(alert.kind,'decline');assert.match(alert.proof,/5.?000.*10.?000/);
 assert.equal(buildContentIntelligence([channel({prevTotals:{views:500,engagements:0,followers:0,posts_count:0,reach:0}})],[],now).watch.length,0);
});
test('a production reference retains its source and excludes young or unmatched posts',()=>{
 const posts=[post('top',1000),post('one',100),post('two',100),post('three',100),post('recent',5000,'a','2026-10-12'),post('unmatched',10000,'b'),post('missing',null)];
 const result=buildContentIntelligence([],posts,now);assert.equal(result.references.length,1);assert.equal(result.references[0].post.id,'top');assert.equal(result.references[0].baseline,100);assert.match(result.references[0].brief,/https:\/\/example.com\/top/);assert.match(result.references[0].action,/Reims/);assert.equal(result.pending,1);assert.equal(result.missingViews,1);
});
test('LinkedIn references keep the impressions label and do not mix units',()=>{
 const posts=[1000,100,100,100].map((value,i)=>({...post(String(i),value),platform:'linkedin' as const,visibilityLabel:'Impressions'}));
 const result=buildContentIntelligence([],posts,now);assert.equal(result.references[0].metricLabel,'impressions');assert.match(result.references[0].brief,/impressions/);assert.equal(result.references[0].metricValue,1000);
 const withViews=[...posts,{...post('video',1500),platform:'linkedin' as const}];assert.equal(buildContentIntelligence([],withViews,now).references.length,0);
});
