import assert from 'node:assert/strict';
import {test} from 'node:test';
import {retainedPostExtras} from '../lib/post-metric-extras';
test('LinkedIn optional clicks survive sync with zero distinct from missing',()=>{
 assert.deepEqual(retainedPostExtras('linkedin',{impressions:2000,clicks:32},{}),{clicks:32});
 assert.deepEqual(retainedPostExtras('linkedin',{impressions:2000,clicks:0},{clicks:32}),{clicks:0});
 assert.deepEqual(retainedPostExtras('linkedin',{impressions:2000},{}),{});
 assert.deepEqual(retainedPostExtras('linkedin',{impressions:0,clicks:0},{clicks:32}),{clicks:32});
 assert.deepEqual(retainedPostExtras('linkedin',{clicks:false},{}),{});
 assert.deepEqual(retainedPostExtras('instagram',{clicks:32},{}),{});
});
