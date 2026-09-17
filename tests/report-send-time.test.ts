import test from 'node:test';
import assert from 'node:assert/strict';
import { computeNextSendAt } from '../lib/report-send-time';
test('monthly delivery remains at 9 in Paris across DST and year boundary',()=>{
  for(const [now,expected] of [['2026-09-17T12:00:00Z','2026-10-03T07:00:00.000Z'],['2026-10-03T07:00:00Z','2026-11-03T08:00:00.000Z'],['2026-03-04T12:00:00Z','2026-04-03T07:00:00.000Z'],['2026-12-30T12:00:00Z','2027-01-03T08:00:00.000Z'],['2026-09-01T12:00:00Z','2026-09-03T07:00:00.000Z']]) assert.equal(computeNextSendAt('monthly',new Date(now)),expected);
});
