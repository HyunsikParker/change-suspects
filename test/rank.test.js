import test from 'node:test';
import assert from 'node:assert/strict';
import { rankChanges, reasons, recency } from '../src/core/rank.js';
import { SAMPLE_CHANGES, SAMPLE_INCIDENTS } from '../src/core/sample.js';
import { addMinutes } from '../src/core/time.js';

const NOW = '2026-10-28T14:00:00.000Z';
const incidentOf = (i) => ({ key: `SHOP-${i.ref}`, summary: i.summary, text: `${i.summary}\n${i.description}`, components: [], labels: i.labels, startedAt: addMinutes(NOW, i.startedMin), created: NOW });
const changes = SAMPLE_CHANGES.map((c, n) => ({ key: `SHOP-${n + 1}`, summary: c.summary, text: `${c.summary}\n${c.description}`, components: [], labels: [...c.labels, 'change-suspects-sample'], changedAt: addMinutes(NOW, c.deployedMin), timeSource: 'deployed', risk: c.risk || null }));

test('recency halves at six hours', () => {
  assert.equal(recency(0), 1);
  assert.equal(recency(6), 0.5);
});

test('card payment incident: the timeout change leads, the rollback is listed after the start', () => {
  const r = rankChanges(incidentOf(SAMPLE_INCIDENTS[0]), changes, { windowHours: 72, now: NOW });
  const top = r.before[0];
  assert.equal(top.summary, 'Lower the card payment gateway timeout to 30 seconds');
  assert.equal(top.band, 'strong');
  assert.equal(top.minutesBefore, 35);
  assert.deepEqual(top.sharedLabels, ['payments']);
  assert.ok(top.sharedTerms.includes('gateway') === false && top.sharedTerms.includes('card'));
  assert.equal(r.before[1].summary, 'Upgrade the card tokenisation library to 4.2');
  assert.equal(r.before[1].band, 'possible');
  const search = r.before.find((c) => c.summary.startsWith('Rename search'));
  assert.equal(search.band, 'weak');
  assert.deepEqual(r.after.map((c) => [c.summary, c.minutesAfter]), [['Restore the card payment gateway timeout to 60 seconds', 6]]);
  assert.ok(!r.before.some((c) => c.labels.includes('incident')));
});

test('image incident: the CDN certificate change leads; later changes are after the start', () => {
  const r = rankChanges(incidentOf(SAMPLE_INCIDENTS[1]), changes, { windowHours: 72, now: NOW });
  assert.equal(r.before[0].summary, 'Rotate the TLS certificate on the image CDN');
  assert.equal(r.before[0].band, 'strong');
  assert.ok(r.after.some((c) => c.summary.startsWith('Upgrade the card tokenisation')));
});

test('the window cuts off older changes and nothing is ranked twice', () => {
  const r = rankChanges(incidentOf(SAMPLE_INCIDENTS[0]), changes, { windowHours: 24, now: NOW });
  assert.ok(!r.before.some((c) => c.summary.includes('PayPal') || c.summary.includes('e-mails')));
  const keys = [...r.before, ...r.after].map((c) => c.key);
  assert.equal(new Set(keys).size, keys.length);
});

test('reasons name the evidence', () => {
  const r = rankChanges(incidentOf(SAMPLE_INCIDENTS[0]), changes, { windowHours: 72, now: NOW });
  assert.deepEqual(reasons(r.before[0]).slice(0, 2), ['Deployed 35 min before the start', 'Same label: payments']);
  assert.ok(reasons(r.before[0]).includes('Change risk: High'));
});

test('sample changes from another project are left out', () => {
  const inc = { ...incidentOf(SAMPLE_INCIDENTS[0]), project: 'WEB' };
  const mine = changes.map((c) => ({ ...c, project: 'WEB' }));
  const other = changes.map((c) => ({ ...c, key: `OLD-${c.key}`, project: 'SHOP' }));
  const real = { ...changes[0], key: 'OPS-1', project: 'OPS', labels: ['payments'] };
  const r = rankChanges(inc, [...mine, ...other, real], { windowHours: 72, now: NOW });
  assert.ok(!r.before.some((c) => c.key.startsWith('OLD-')));
  assert.ok(r.before.some((c) => c.key === 'OPS-1'));
});
