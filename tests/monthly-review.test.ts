import test from 'node:test';
import assert from 'node:assert/strict';
import { metricChange, normalizeReviewPost, comparisonIssue, filterReviewPosts, extraChannelMetrics } from '../lib/monthly-review';
import { getPostVisibility } from '../lib/metrics';
test('missing and zero baselines never create a percentage',()=>{assert.equal(metricChange(50,0).percent,null);assert.equal(metricChange(0,50).percent,-100);assert.equal(metricChange(null,50).difference,null);});
test('visibility searches populated aliases and retains the real metric label',()=>{assert.deepEqual(getPostVisibility({views:0,video_views:240,reach:0}),{label:'Vues',value:240});assert.deepEqual(getPostVisibility({views:0,impressions:400,reach:0}),{label:'Impressions',value:400});});
test('post details distinguish missing visibility, missing interactions and measured zero',()=>{const p=normalizeReviewPost({id:'1',platform:'instagram',metrics:{reach:0,engagements:0}});assert.equal(p.visibility,null);assert.equal(p.engagements,0);assert.equal(normalizeReviewPost({id:'2',metrics:{}}).engagements,null);});
test('comparison rejects different networks and accounts',()=>{const a=normalizeReviewPost({id:'1',platform:'instagram',social_account_id:'a'});assert.ok(comparisonIssue([a,{...a,id:'2',platform:'facebook'}]));assert.ok(comparisonIssue([a,{...a,id:'2',accountId:'b'}]));assert.equal(comparisonIssue([a,{...a,id:'2'}]),null);});
test('content search is accent insensitive and unknown measurements rank last',()=>{const a=normalizeReviewPost({id:'1',caption:'Équipe',metrics:{engagements:5}});const b=normalizeReviewPost({id:'2',caption:'Notre équipe'});assert.deepEqual(filterReviewPosts([b,a],'equipe','all','all','engagements').map(p=>p.id),['1','2']);});
