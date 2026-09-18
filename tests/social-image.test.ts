import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./helpers/report-loader.mjs',import.meta.url);
const { isSocialImageUrl, downloadSocialImage } = await import('../lib/social-image');

test('image proxy only downloads trusted CDN URLs and checks redirects',async()=>{
  assert.equal(isSocialImageUrl('https://scontent.cdninstagram.com/photo.jpg'),true);
  for(const url of ['http://scontent.fbcdn.net/a','https://127.0.0.1/a','https://fbcdn.net.attacker.test/a','https://user:pass@fbcdn.net/a','https://fbcdn.net:123/a'])assert.equal(isSocialImageUrl(url),false);
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}});};
  try{assert.equal(await downloadSocialImage('https://scontent.fbcdn.net/a'),null);assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
test('image proxy validates bytes and rejects HTML and oversized payloads',async()=>{
  const original=globalThis.fetch;
  try{
    globalThis.fetch=async()=>new Response('<html>expired</html>',{headers:{'content-type':'image/jpeg'}});
    assert.equal(await downloadSocialImage('https://scontent.fbcdn.net/a'),null);
    globalThis.fetch=async()=>new Response(new Uint8Array([255,216,255,224]));
    assert.equal((await downloadSocialImage('https://scontent.fbcdn.net/a'))?.type,'image/jpeg');
    globalThis.fetch=async()=>new Response('x',{headers:{'content-length':'9000000'}});
    assert.equal(await downloadSocialImage('https://scontent.fbcdn.net/a'),null);
  }finally{globalThis.fetch=original;}
});
