import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./helpers/report-loader.mjs',import.meta.url);
register('./helpers/content-route-loader.mjs',import.meta.url);
const {GET}=await import('../app/api/client/posts/[postId]/preview/route');
const {POST}=await import('../app/api/admin/repair-content/route');
const g=globalThis as any;
const request=new Request('https://dashboard.example/api/client/posts/123/preview');
const params={params:{postId:'12345678-1234-1234-1234-123456789012'}};
function query(data:unknown){const q:any={select:()=>q,eq:()=>q,single:async()=>({data}),maybeSingle:async()=>({data})};return q;}
test('anonymous image reads and repairs are denied before accessing service data',async()=>{
 g.__contentSession={auth:{getUser:async()=>({data:{user:null}})}};
 g.__contentService={from:()=>{throw Error('service must not be called')}};
 assert.equal((await GET(request,params)).status,401);
 assert.equal((await POST(request)).status,401);
});
test('clients cannot repair all tenants or read another tenant preview',async()=>{
 g.__contentSession={auth:{getUser:async()=>({data:{user:{id:'u'}}})},from:(table:string)=>query(table==='profiles'?{role:'client_user',tenant_id:'own'}:null)};
 g.__contentService={from:()=>query({id:params.params.postId,tenant_id:'another',platform:'instagram'})};
 assert.equal((await GET(request,params)).status,404);
 assert.equal((await POST(request)).status,403);
});
test('repair batches use a stable cursor and never skip the ninth stored post',async()=>{
 const ids=Array.from({length:9},(_,i)=>`00000000-0000-0000-0000-${String(i).padStart(12,'0')}`);
 const rows=ids.map(id=>({id,tenant_id:'12345678-1234-1234-1234-123456789012',platform:'linkedin',media_type:'text',metrics:{}}));
 const calls:any[]=[];
 g.__contentSession={auth:{getUser:async()=>({data:{user:{id:'admin'}}})},from:()=>query({role:'agency_admin'})};
 g.__contentService={from:(table:string)=>{
   const data=table==='tenants'?{id:rows[0].tenant_id,is_active:true,is_demo:false}:table==='social_accounts'?[]:rows;
   const q:any={select:()=>q,eq:(...args:any[])=>{calls.push([table,...args]);return q;},order:()=>q,limit:()=>q,gt:()=>q,single:async()=>({data}),then:(resolve:any)=>Promise.resolve({data}).then(resolve)};return q;
 }};
 const result=await POST(new Request('https://dashboard.example/api/admin/repair-content',{method:'POST',body:JSON.stringify({tenantId:rows[0].tenant_id})}));
 const data=await result.json();
 assert.equal(result.status,200);assert.equal(data.checked,8);assert.equal(data.results.length,8);assert.equal(data.nextCursor,ids[7]);
 assert.ok(calls.some(c=>c[0]==='social_posts'&&c[1]==='tenant_id'&&c[2]===rows[0].tenant_id));
});
