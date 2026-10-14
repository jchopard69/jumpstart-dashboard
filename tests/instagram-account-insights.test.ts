import assert from 'node:assert/strict';
import {test} from 'node:test';
import {collectInstagramDay,collectInstagramDays,instagramDates} from '../lib/social-platforms/meta/account-insights';
test('a one-day account total is assigned to that exact day without reach-based distribution',async()=>{
 const row=await collectInstagramDay('2026-08-20',async(day,metrics)=>{assert.equal(day,'2026-08-20');assert.ok(metrics.includes('views'));return {data:[{name:'views',total_value:{value:250000}},{name:'reach',total_value:{value:70000}}]};});
 assert.equal(row.date,'2026-08-20');assert.equal(row.views,250000);assert.equal(row.reach,70000);assert.equal(row.raw_json?._ig_daily_views_version,1);assert.equal(row.engagements,undefined);
});
test('unsupported optional metrics do not suppress views; auth errors do not multiply requests',async()=>{
 let calls=0;const row=await collectInstagramDay('2026-08-20',async(_,metrics)=>{calls++;if(metrics.length>1)throw Error('invalid parameter');return {data:[{name:'views',total_value:{value:0}}]};});assert.equal(row.views,0);assert.equal(calls,2);
 calls=0;await assert.rejects(collectInstagramDay('2026-08-20',async()=>{calls++;throw Error('Invalid OAuth token');}));assert.equal(calls,1);
});
test('missing views is a failure, never a synthetic zero or post-view proxy',async()=>{
 await assert.rejects(collectInstagramDay('2026-08-20',async()=>({data:[{name:'reach',total_value:{value:20000}}]})),/non fournies/);
 const result=await collectInstagramDays(['2026-08-20','2026-08-21'],async(day)=>day.endsWith('20')?{data:[{name:'views',total_value:{value:2000000}}]}:{data:[]});assert.equal(result.rows.length,1);assert.deepEqual(result.failed,['2026-08-21']);
});
test('routine recovery covers historical days and refreshes the recent week without revisiting all verified history',()=>{
 const now=Date.parse('2026-10-14T12:00:00Z');const all=instagramDates(now);assert.equal(all.length,89);assert.ok(all.includes('2026-08-01'));assert.equal(all.at(-1),'2026-10-13');
 const known=Object.fromEntries(all.map(day=>[day,1]));assert.equal(instagramDates(now,known).length,7);
});
