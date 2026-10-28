import test from 'node:test';
import assert from 'node:assert/strict';
import { seedSample } from '../src/core/seed.js';
import { SAMPLE_CHANGES, SAMPLE_INCIDENTS } from '../src/core/sample.js';

function fakeJira() {
  const calls = [];
  let n = 0;
  const request = async (method, path, body) => {
    calls.push([method, path, body]);
    if (path.includes('/createmeta/')) return { issueTypes: [{ id: '1', name: '작업', untranslatedName: 'Task', hierarchyLevel: 0 }, { id: '2', name: '버그', untranslatedName: 'Bug', hierarchyLevel: 0 }, { id: '3', name: 'Sub', subtask: true }] };
    if (method === 'POST' && path === '/rest/api/3/issue') return { key: `SHOP-${++n}` };
    if (path.endsWith('/transitions') && method === 'GET') return { transitions: [{ id: '31', to: { statusCategory: { key: 'done' } } }] };
    return null;
  };
  return { calls, request };
}

test('the sample creates the changes as done tasks with deploy times, then the incidents as bugs', async () => {
  const j = fakeJira();
  const r = await seedSample(j.request, 'SHOP', '2026-10-28T14:00:00.000Z');
  assert.equal(r.changes.length, SAMPLE_CHANGES.length);
  assert.equal(r.incidents.length, SAMPLE_INCIDENTS.length);
  const creates = j.calls.filter(([m, p]) => m === 'POST' && p === '/rest/api/3/issue');
  assert.equal(creates[0][2].fields.issuetype.id, '1');
  assert.equal(creates.at(-1)[2].fields.issuetype.id, '2');
  assert.ok(creates.every(([, , b]) => b.fields.labels.includes('change-suspects-sample')));
  const props = j.calls.filter(([m, p]) => m === 'PUT' && p.includes('/properties/change-suspects'));
  assert.deepEqual(props[0][2], { deployedAt: '2026-10-28T13:13:00Z', risk: 'High' });
  assert.deepEqual(props.at(-1)[2], { startedAt: '2026-10-28T09:50:00Z' });
  assert.equal(j.calls.filter(([m, p]) => m === 'POST' && p.endsWith('/transitions')).length, SAMPLE_CHANGES.length);
});
