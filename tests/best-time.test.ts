import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeBestTime } from '../lib/best-time';
const posts=Array.from({length:8},(_,i)=>({platform:'instagram',posted_at:`2026-08-${String(i+1).padStart(2,'0')}T08:00:00Z`,metrics:{views:100+i,engagements:10+i}}));
test('publishing windows use Paris time and a single named metric',()=>{const data=analyzeBestTime(posts)!;assert.equal(data.timeZone,'Europe/Paris');assert.equal(data.metricLabel,'Vues');assert.equal(data.totalPostsAnalyzed,8);assert.ok(data.slots.filter(s=>s.postCount).every(s=>s.hour===2));});
test('missing visibility falls back to measured interactions without renaming it',()=>{const data=analyzeBestTime(posts.map(p=>({...p,metrics:{views:0,engagements:20}})))!;assert.equal(data.metricLabel,'Interactions');});
test('no optimal window is fabricated from zero or missing measurements',()=>{assert.equal(analyzeBestTime(posts.map(p=>({...p,metrics:{}}))),null);assert.equal(analyzeBestTime(posts.map(p=>({...p,metrics:{engagements:0}}))),null);});
test('networks are not pooled to select an optimal window',()=>assert.equal(analyzeBestTime([...posts,{...posts[0],platform:'facebook'}]),null));
test('small samples and invalid dates cannot imply a recommendation',()=>{assert.equal(analyzeBestTime(posts.slice(0,4)),null);assert.equal(analyzeBestTime(posts.map(p=>({...p,posted_at:'invalid'}))),null);});
