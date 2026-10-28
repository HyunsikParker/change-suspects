import test from 'node:test';
import assert from 'node:assert/strict';
import { timelineEvents, timelineAdf } from '../src/core/timeline.js';

const ranking = {
  before: [
    { key: 'SHOP-3', summary: 'Upgrade library', changedAt: '2026-10-28T10:38:00Z', timeSource: 'deployed', band: 'possible' },
    { key: 'SHOP-1', summary: 'Lower timeout', changedAt: '2026-10-28T13:13:00Z', timeSource: 'deployed', band: 'strong' },
  ],
  after: [{ key: 'SHOP-8', summary: 'Restore timeout', changedAt: '2026-10-28T13:54:00Z', timeSource: 'deployed' }],
};
const incident = { key: 'SHOP-9', summary: 'Card payments time out', startedAt: '2026-10-28T13:48:00Z', created: '2026-10-28T14:00:00Z' };

test('events are in time order with the start and the report', () => {
  const e = timelineEvents(incident, ranking, ['SHOP-1']);
  assert.deepEqual(e.map((x) => `${x.kind}:${x.key}`), ['change:SHOP-3', 'change:SHOP-1', 'start:SHOP-9', 'after:SHOP-8', 'reported:SHOP-9']);
  assert.equal(e[1].marked, true);
});

test('the comment uses the reader\'s time zone and links keys', () => {
  const adf = timelineAdf(timelineEvents(incident, ranking, ['SHOP-1']), { timeZone: 'Asia/Seoul', siteUrl: 'https://x.atlassian.net', windowText: '3 days' });
  const items = adf.content[1].content.map((li) => li.content[0].content.map((t) => t.text).join(''));
  assert.equal(items[1], '28 Oct, 22:13  SHOP-1 Lower timeout (deployed, strong suspect) - marked as suspected cause');
  assert.equal(items[2], '28 Oct, 22:48  Incident started');
  assert.equal(items[3], '28 Oct, 22:54  SHOP-8 Restore timeout (deployed, after the start)');
  assert.equal(adf.content[1].content[1].content[0].content[1].marks[0].attrs.href, 'https://x.atlassian.net/browse/SHOP-1');
  assert.match(adf.content[0].content[0].text, /3 days before the start, times in Asia\/Seoul/);
});

test('weak matches stay out of the timeline unless marked', () => {
  const r = { before: [...ranking.before, { key: 'IPF-2', summary: 'Other project', changedAt: '2026-10-28T09:00:00Z', timeSource: 'resolved', band: 'weak' }], after: [] };
  const e = timelineEvents(incident, r, []);
  assert.ok(!e.some((x) => x.key === 'IPF-2'));
  assert.equal(e.omitted, 1);
  assert.match(JSON.stringify(timelineAdf(e)), /1 other change in the window matched only weakly/);
  assert.ok(timelineEvents(incident, r, ['IPF-2']).some((x) => x.key === 'IPF-2'));
});
