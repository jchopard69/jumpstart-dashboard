import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchShareStatsByPost} from '../lib/social-platforms/linkedin/community';

test('LinkedIn UGC statistics use encoded Rest.li 2 lists and preserve the returned impressions',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(input)=>{
  calls++;const url=String(input);
  assert.ok(url.includes('ugcPosts=List(urn%3Ali%3AugcPost%3A123,urn%3Ali%3AugcPost%3A456)'));
  assert.ok(!url.includes('ugcPosts['));
  return new Response(JSON.stringify({elements:[{ugcPost:'urn:li:ugcPost:123',totalShareStatistics:{impressionCount:4567,likeCount:34}},{ugcPost:'urn:li:ugcPost:456',totalShareStatistics:{impressionCount:0}}]}),{status:200,headers:{'content-type':'application/json'}});
 };
 try{
  const result=await fetchShareStatsByPost({'X-Restli-Protocol-Version':'2.0.0'},'urn:li:organization:test',['urn:li:ugcPost:123','urn:li:ugcPost:456']);
  assert.equal(calls,1);assert.equal(result['urn:li:ugcPost:123'].impressions,4567);assert.equal(result['urn:li:ugcPost:456'].impressions,0);
 }finally{globalThis.fetch=original;}
});
test('LinkedIn supports legacy indexed parameters only after a parameter rejection',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(input)=>{
  calls++;
  if(calls===1)return new Response(JSON.stringify({message:'Invalid query',errorDetails:{inputErrors:[{code:'QUERY_PARAM_NOT_ALLOWED'}]}}),{status:400,headers:{'content-type':'application/json'}});
  assert.ok(String(input).includes('ugcPosts[0]=urn%3Ali%3AugcPost%3A123'));
  return new Response(JSON.stringify({elements:[{ugcPost:'urn:li:ugcPost:123',totalShareStatistics:{impressionCount:80}}]}),{status:200,headers:{'content-type':'application/json'}});
 };
 try{assert.equal((await fetchShareStatsByPost({},'urn:li:organization:test',['urn:li:ugcPost:123']))['urn:li:ugcPost:123'].impressions,80);assert.equal(calls,2);}finally{globalThis.fetch=original;}
});
