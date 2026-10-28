import test from 'node:test';
import assert from 'node:assert/strict';
import { spanText, windowText, jqlDates, addMinutes, toMs, zonedParts, zonedToIso } from '../src/core/time.js';

test('spans read the way people say them', () => {
  assert.equal(spanText(35), '35 min');
  assert.equal(spanText(190), '3 h 10 min');
  assert.equal(spanText(360), '6 h');
  assert.equal(spanText(26 * 60), '26 h');
  assert.equal(spanText(52 * 60), '2 days 4 h');
  assert.equal(spanText(-12), '12 min');
});

test('windows and JQL bounds', () => {
  assert.equal(windowText(24), '24 hours');
  assert.equal(windowText(72), '3 days');
  assert.deepEqual(jqlDates('2026-10-28T14:00:00Z', 72, '2026-10-28T14:30:00Z'), { from: '2026-10-24', to: '2026-10-29' });
  assert.equal(addMinutes('2026-10-28T14:00:00.000Z', -47), '2026-10-28T13:13:00.000Z');
  assert.equal(toMs('not a date'), null);
});

test('start times are entered in the Jira profile time zone', () => {
  assert.deepEqual(zonedParts('2026-10-28T13:51:00.000Z', 'America/New_York'), { date: '2026-10-28', time: '09:51' });
  assert.deepEqual(zonedParts('2026-10-28T13:51:00.000Z', 'Asia/Seoul'), { date: '2026-10-28', time: '22:51' });
  assert.equal(zonedToIso('2026-10-28', '09:51', 'America/New_York'), '2026-10-28T13:51:00.000Z');
  assert.equal(zonedToIso('2026-11-02', '09:00', 'America/New_York'), '2026-11-02T14:00:00.000Z');
  assert.equal(zonedToIso('2026-10-29', '00:30', 'Asia/Seoul'), '2026-10-28T15:30:00.000Z');
});
