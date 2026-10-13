import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildContentIntelligence} from '../lib/content-intelligence';
import type {ReviewPost} from '../lib/monthly-review';
const now=Date.parse('2026-10-13T12:00:00Z');
function post(id:string,views:number|null,format='Reel',accountId='a',date='2026-09-01'):ReviewPost{return{id,platform:'instagram',accountId,date,format,caption:'Sujet concret',thumbnail:null,url:null,visibility:views,visibilityLabel:'Vues',engagements:30,likes:25,comments:5,shares:0,saves:0};}
test('format medians resist exceptional hits and representatives are typical',()=>{
 const result=buildContentIntelligence([100,110,120,10000].map((v,i)=>post('r'+i,v)),now)[0];
 assert.equal(result.formats[0].median,115);assert.equal(result.formats[0].representative?.id,'r1');assert.equal(result.topShare,null);
});
test('accounts and units are isolated; LinkedIn impressions retain their definition',()=>{
 const impressions=[100,200,300].map((v,i)=>({...post('i'+i,v,'Texte','b'),platform:'linkedin' as const,visibilityLabel:'Impressions'}));
 const result=buildContentIntelligence([...impressions,post('video',10,'Vidéo','b'),post('other',99999,'Reel','c')],now);
 assert.equal(result.length,3);assert.equal(result[0].unit,'impressions');assert.equal(result[0].total,600);
 const mixed=buildContentIntelligence([...impressions,{...post('realviews',10,'Vidéo','b'),platform:'linkedin' as const}],now)[0];
 assert.equal(mixed.unit,'vues');assert.equal(mixed.measured,1);assert.equal(mixed.total,10);
});
test('missing is not zero; recent and invalid dates cannot enter a format baseline',()=>{
 const result=buildContentIntelligence([post('zero',0),post('missing',null),post('young',100,'Reel','a','2026-10-12'),post('invalid',200,'Reel','a','')],now)[0];
 assert.equal(result.measured,3);assert.equal(result.formats[0].eligible,1);assert.equal(result.formats[0].median,null);
 assert.equal(buildContentIntelligence([post('none',null)],now)[0].total,null);
});
test('a concrete opportunity needs enough measures, coverage and similar ages',()=>{
 const reels=[1000,1100,1200].map((v,i)=>post('r'+i,v));
 const images=[100,110,120].map((v,i)=>post('i'+i,v,'Image'));
 const result=buildContentIntelligence([...reels,...images],now)[0];assert.equal(result.opportunity?.lift,900);assert.equal(result.formats.reduce((s,f)=>s+f.visibilityShare!,0),100);
 for(const additions of [[post('missing',null)],[post('missing',null),post('missing2',null)]])assert.equal(buildContentIntelligence([...reels,...images,...additions],now)[0].opportunity,null);
 assert.equal(buildContentIntelligence([...reels,...images.map(p=>({...p,date:'2026-05-01'}))],now)[0].opportunity,null);
 assert.equal(buildContentIntelligence([...reels,...images].map(p=>({...p,accountId:''})),now)[0].opportunity,null);
});
test('concentration requires sufficient measured content and no positive denominator is invented',()=>{
 const result=buildContentIntelligence([1000,0,0,0,0].map((v,i)=>post(String(i),v)),now)[0];assert.equal(result.topShare,100);
 const zero=buildContentIntelligence([0,0,0,0,0].map((v,i)=>post(String(i),v)),now)[0];assert.equal(zero.topShare,null);assert.equal(zero.formats[0].visibilityShare,null);
});
test('a third comparable format is considered when the nearest challenger is close',()=>{
 const posts=[['Carrousel',56000],['Reel',49000],['Image',38000]].flatMap(([format,value])=>Array.from({length:3},(_,i)=>post(String(format)+i,Number(value),String(format))));
 const result=buildContentIntelligence(posts,now)[0];assert.equal(result.opportunity?.best.format,'Carrousel');assert.equal(result.opportunity?.other.format,'Image');
});
