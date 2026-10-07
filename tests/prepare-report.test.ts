import assert from "node:assert/strict";
import { test } from "node:test";
import { register } from "node:module";
register("./helpers/report-loader.mjs", import.meta.url);
const { prepareReport } = await import("../lib/prepare-report");

test("real report preparation does not turn an empty collection into a score or a decline", async () => {
  const totals = { followers: 0, views: 0, reach: 0, engagements: 0, posts_count: 0 };
  const data = {
    totals, prevTotals: { followers: 1000, views: 5000, reach: 3000, engagements: 500, posts_count: 5 },
    metrics: [], posts: [], perPlatform: [{ platform: "instagram", totals, prevTotals: totals, available: { views: true, reach: true, engagements: true }, delta: totals }], lastSync: null,
    range: { start: new Date(2026, 7, 1), end: new Date(2026, 7, 31) },
    prevRange: { start: new Date(2026, 6, 1), end: new Date(2026, 6, 31) },
  } as unknown as Parameters<typeof prepareReport>[0]["data"];
  const report = await prepareReport({ data, accounts: [], tenantName: "Test" });
  assert.equal(report.score, undefined);
  for (const label of ["Abonnés", "Vues", "Interactions"]) {
    const metric = report.kpis.find(kpi => kpi.label === label)!;
    assert.equal(metric.value, null, label);
    assert.equal(metric.delta, null, label);
  }
  assert.equal(report.postsAnalyzed, 0);
  assert.equal(report.platforms[0].hasCurrentMetrics, false);
});

test("All client PDFs select the five most viewed posts per network while retaining full statistics", async () => {
  const posts = ['instagram', 'facebook'].flatMap(platform => Array.from({length:8}, (_,i) => ({
    id:`${platform}-${i}`, platform, social_account_id:`account-${platform}`, posted_at:'2026-09-10T12:00:00Z',
    caption:`${platform}-${i}`, media_type:'image', metrics:{views:(i+1)*100,likes:100-i,engagements:100-i},
  })));
  const totals={followers:1000,views:3600,reach:0,engagements:36,posts_count:8};
  const data={
    totals,prevTotals:totals, metrics:[],prevMetrics:[],posts,lastSync:null,
    perPlatform:['instagram','facebook'].map(platform=>({platform,totals,prevTotals:totals,available:{views:true,reach:false,engagements:true},delta:totals})),
    range:{start:new Date(2026,8,1),end:new Date(2026,8,30)},
    prevRange:{start:new Date(2026,7,1),end:new Date(2026,7,31)},
  } as unknown as Parameters<typeof prepareReport>[0]['data'];
  for (const tenantId of ['050d9f12-296e-47f1-91dc-44c38d8dcdd1','e2685522-91a9-4b24-8812-0d9a85b078c9','other']) {
    const report=await prepareReport({data,accounts:[],tenantName:'Client',tenantId});
    assert.equal(report.posts.length,10);
    assert.equal(report.postsAnalyzed,16);
    assert.equal(report.postLimitPerPlatform,5);
    for (const platform of ['instagram','facebook']) {
      assert.equal(report.posts.filter(p=>p.platform===platform).length,5);
      assert.equal(report.posts.find(p=>p.platform===platform)?.caption, `${platform}-7`);
      assert.equal(report.posts.find(p=>p.caption===`${platform}-0`),undefined);
      assert.equal(report.platforms.find(p=>p.platform===platform)?.totals.views,3600);
    }
  }
  const other=await prepareReport({data,accounts:[],tenantName:'Autre client',tenantId:'other'});
  assert.equal(other.posts.length,10);
  assert.equal(other.postLimitPerPlatform,5);
});

test("PDF ranking excludes missing views and labels the impressions fallback honestly", async () => {
  const {buildPdfPostSummaries}=await import('../lib/pdf-posts');
  const measured=await buildPdfPostSummaries([
    {caption:'Most viewed',platform:'instagram',metrics:{views:900,likes:1}},
    {caption:'More likes',platform:'instagram',metrics:{views:100,likes:999}},
    {caption:'Views missing',platform:'instagram',metrics:{reach:100000,likes:10000}},
  ],5);
  assert.deepEqual(measured.map(p=>p.caption),['Most viewed','More likes']);
  assert.equal(measured[0].visibility.label,'Vues');
  const fallback=await buildPdfPostSummaries([
    {caption:'Second',platform:'linkedin',metrics:{impressions:100}},
    {caption:'First',platform:'linkedin',metrics:{impressions:200}},
  ],5);
  assert.equal(fallback[0].caption,'First');
  assert.equal(fallback[0].visibility.label,'Impressions');
});
