import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStrategicReading } from '../lib/strategic-reading';
import { normalizeReviewPost } from '../lib/monthly-review';
const posts=[10,15,70].map((comments,i)=>normalizeReviewPost({id:String(i),caption:`Projet ${i}`,platform:'linkedin',social_account_id:'a',media_type:'IMAGE',metrics:{comments,engagements:comments}}));
test('strategy includes a real reference and its measured peer group',()=>{const [signal]=buildStrategicReading(posts);assert.equal(signal.postId,'2');assert.match(signal.observation,/70 commentaires/);assert.match(signal.observation,/15, valeur médiane/);assert.match(signal.action,/Projet 2/);});
test('no editorial advice from a single post, another account or a flat distribution',()=>{assert.deepEqual(buildStrategicReading(posts.slice(0,2)),[]);assert.deepEqual(buildStrategicReading(posts.map((p,i)=>({...p,accountId:String(i)}))),[]);assert.deepEqual(buildStrategicReading(posts.map(p=>({...p,comments:10,engagements:10}))),[]);});

test('isolated reactions do not generate strategic recommendations',()=>{assert.deepEqual(buildStrategicReading(posts.map((p,i)=>({...p,comments:i,engagements:i}))),[]);});
