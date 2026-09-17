import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContentObservatory, buildPublicationCalendar, publicationDay } from '../lib/content-observatory';
import { normalizeReviewPost } from '../lib/monthly-review';
const post=(id:number,engagements:number|null,account='a')=>normalizeReviewPost({id:String(id),platform:'instagram',social_account_id:account,media_type:'IMAGE',posted_at:'2026-08-01T10:00:00Z',metrics:engagements==null?{}:{engagements}});
test('format medians retain measured zeros, exclude missing metrics and separate accounts',()=>{
 const groups=buildContentObservatory([post(1,0),post(2,10),post(3,20),post(4,null),post(5,900,'b')]);
 assert.equal(groups.length,2);assert.equal(groups[0].formats[0].engagements.median,10);assert.equal(groups[0].formats[0].engagements.count,3);assert.equal(groups[1].formats[0].engagements.median,null);
});
test('concentration uses measured cohort, requires five measurements and excludes unknown account',()=>{
 const result=buildContentObservatory([post(1,80),post(2,5),post(3,5),post(4,5),post(5,5),post(6,null),post(7,100,'')])[0];
 assert.equal(result.count,6);assert.equal(result.measured,5);assert.equal(result.topCount,1);assert.equal(result.topShare,80);
 assert.equal(buildContentObservatory([post(1,10)])[0].topShare,null);
 assert.equal(buildContentObservatory(Array.from({length:5},(_,i)=>post(i,0)))[0].topShare,null);
});
test('calendar uses Paris local dates across UTC midnight and includes days without collected posts',()=>{
 assert.equal(publicationDay('2026-08-01T23:30:00Z'),'2026-08-02');
 assert.equal(publicationDay('invalid'),null);
 const days=buildPublicationCalendar([{...post(1,5),date:'2026-08-01T23:30:00Z'}],'2026-08-01','2026-08-03');
 assert.deepEqual(days.map(d=>d.count),[0,1,0]);assert.equal(days[0].weekday,5);
 assert.deepEqual(buildPublicationCalendar([],'bad','bad'),[]);
});

test('format advice does not compare different accounts or a sample below three',async()=>{
 const {buildFormatAdvice}=await import('../lib/content-observatory');
 const images=[post(1,10),post(2,10),post(3,10)];
 const videos=[post(4,40),post(5,50),post(6,60)].map(p=>({...p,format:'Vidéo'}));
 assert.equal(buildFormatAdvice([...images,...videos]).length,1);
 assert.equal(buildFormatAdvice([...images,...videos.map(p=>({...p,accountId:'b'}))]).length,0);
 assert.equal(buildFormatAdvice([...images,...videos.slice(0,2)]).length,0);
});
