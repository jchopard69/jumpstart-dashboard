import test from 'node:test';
import assert from 'node:assert/strict';
import { collectPostInsights, insightValue, mergeMetaPostMetrics } from '../lib/social-platforms/meta/post-insights';
import { getPostVisibilityDetails } from '../lib/metrics';

test('Meta accepts scalar zero and both insight envelopes, never sums arbitrary breakdowns', () => {
  assert.equal(insightValue({values:[{value:0}]}),0);
  assert.equal(insightValue({total_value:{value:125}}),125);
  for (const row of [{}, {values:[]}, {value:null}, {value:NaN}, {value:-1}, {value:{organic:3,total:5}}]) assert.equal(insightValue(row),undefined);
});
test('Instagram requests views for images too and preserves interactions without double counting saves', async () => {
  const result = await collectPostInsights('instagram', async metrics => {
    assert.ok(metrics.includes('views'));
    return {data:[{name:'views',total_value:{value:1234}},{name:'total_interactions',value:40},{name:'saved',value:8}]};
  });
  assert.deepEqual(result,{views:1234,engagements:40,saves:8});
});
test('an unsupported metric is isolated to its post and successful siblings survive', async () => {
  const result = await collectPostInsights('instagram', async metrics => {
    if(metrics.length>1 || metrics[0]==='reach') throw Error('Invalid parameter');
    return {data:[{name:metrics[0],value:metrics[0]==='views'?678:0}]};
  });
  assert.equal(result.views,678); assert.equal(result.reach,undefined);
  const next = await collectPostInsights('instagram', async () => ({data:[{name:'reach',value:321}]}));
  assert.equal(next.reach,321);
});
test('auth failures and empty responses do not generate fake zeros or multiply requests', async () => {
  let calls=0;
  const result=await collectPostInsights('facebook', async()=>{calls++;throw Error('Permissions error');});
  assert.deepEqual(result,{});assert.equal(calls,1);
  assert.deepEqual(await collectPostInsights('instagram',async()=>({data:[]})),{});
});
test('Facebook views and unique viewers retain their own names',async()=>{
  const result=await collectPostInsights('facebook',async()=>({data:[{name:'post_media_view',values:[{value:500}]},{name:'post_total_media_view_unique',values:[{value:300}]}]}));
  assert.deepEqual(result,{views:500,viewers:300});
});
test('empty refresh preserves dated observations; an observed zero replaces the previous value',()=>{
  const initial=mergeMetaPostMetrics('instagram',{views:123,reach:100},{},1000);
  const failed=mergeMetaPostMetrics('instagram',{likes:5},initial,2000);
  assert.equal(failed.views,123);assert.equal(failed._views_collected_at,1000);
  const zero=mergeMetaPostMetrics('instagram',{views:0},failed,3000);
  assert.equal(zero.views,0);assert.equal(zero._views_collected_at,3000);
});
test('legacy Facebook aliases are discarded without losing measured views',()=>{
  const result=mergeMetaPostMetrics('facebook',{}, {views:900,reach:900,impressions:900,media_views:900},1000);
  assert.equal(result.views,900);assert.equal(result.reach,undefined);assert.equal(result.impressions,undefined);
});
test('content details expose each measurement and omit legacy fabricated zeros',()=>{
  assert.deepEqual(getPostVisibilityDetails({views:123,reach:80,impressions:0}),[{label:'Vues',value:123,collectedAt:undefined},{label:'Portée',value:80,collectedAt:undefined}]);
  assert.equal(getPostVisibilityDetails({views:0,_views_collected_at:1000})[0].value,0);
});

test('busy accounts rotate collection toward unmeasured and oldest checked posts', async()=>{
  const {prioritizePostInsights}=await import('../lib/social-platforms/meta/post-insights');
  assert.deepEqual(prioritizePostInsights([{id:'recent'},{id:'never'},{id:'older'}],{recent:2000,older:1000}).map(p=>p.id),['never','older','recent']);
});

test('the Instagram connector paginates beyond 100 posts and retrieves image visibility end to end', async()=>{
  const {instagramConnector}=await import('../lib/social-platforms/meta/api');
  const original=globalThis.fetch;
  const seen:string[]=[];
  globalThis.fetch=async(input)=>{
    const url=new URL(String(input));
    let body:unknown={data:[]};
    if(url.pathname.endsWith('/test-ig')) body={followers_count:200,media_count:101};
    else if(url.pathname.endsWith('/media')) {
      const page=Number(url.searchParams.get('page')??0);
      const count=page===2?1:50;
      body={data:Array.from({length:count},(_,i)=>({id:`image-${page*50+i}`,media_type:'IMAGE',timestamp:new Date().toISOString(),like_count:2,comments_count:1})),...(page<2?{paging:{next:`https://graph.facebook.com/v25.0/test-ig/media?page=${page+1}`}}:{})};
    } else if(url.pathname.includes('/image-')) {
      seen.push(url.searchParams.get('metric')??'');
      body={data:[{name:'views',values:[{value:4321}]},{name:'reach',values:[{value:2100}]}]};
    }
    return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
  };
  try {
    const result=await instagramConnector.sync({tenantId:'test',socialAccountId:'test',externalAccountId:'test-ig',accessToken:'test-only'});
    assert.equal(result.posts.length,101);assert.equal(seen.length,101);
    assert.ok(seen.every(metrics=>metrics.includes('views')));
    assert.ok(result.posts.every(p=>p.metrics?.views===4321));
    assert.ok(result.dailyMetrics.every(row=>(row.views??0)===0),'Lifetime post views must not inflate daily account views');
  }finally{globalThis.fetch=original;}
});
test('the Facebook connector retrieves visibility after post 40 without manufacturing reach',async()=>{
  const {facebookConnector}=await import('../lib/social-platforms/meta/api');
  const original=globalThis.fetch;
  globalThis.fetch=async(input)=>{
    const url=new URL(String(input));let body:unknown={data:[]};
    if(url.pathname.endsWith('/test-fb')) body={followers_count:100};
    else if(url.pathname.endsWith('/posts')) body={data:Array.from({length:45},(_,i)=>({id:`fb-${i}`,created_time:new Date().toISOString()}))};
    else if(url.pathname.includes('/fb-')) body={data:[{name:'post_media_view',total_value:{value:700}},{name:'post_total_media_view_unique',value:500}]};
    return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
  };
  try{
    const result=await facebookConnector.sync({tenantId:'test',socialAccountId:'test',externalAccountId:'test-fb',accessToken:'test-only'});
    assert.equal(result.posts.length,45);assert.equal(result.posts[44].metrics?.views,700);
    assert.equal(result.posts[44].metrics?.reach,undefined);assert.equal(result.posts[44].metrics?.impressions,undefined);
  }finally{globalThis.fetch=original;}
});

test('Meta content prefers views and falls back to unique viewers with an explicit label',async()=>{
  const {getPostVisibility}=await import('../lib/metrics');
  assert.deepEqual(getPostVisibility({impressions:900,views:800},'image','facebook'),{label:'Vues',value:800});
  assert.deepEqual(getPostVisibility({views:0,viewers:450},'image','facebook'),{label:'Spectateurs uniques',value:450});
});
