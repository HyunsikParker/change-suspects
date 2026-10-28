// Loads the sample into a Jira project through an injected request function, so it is testable without Forge.
// `request(method, path, body)` resolves to parsed JSON or null.
import { PROPERTY } from './adapt.js';
import { SAMPLE_CHANGES, SAMPLE_INCIDENTS, SAMPLE_LABEL } from './sample.js';
import { addMinutes } from './time.js';

const doc = (t) => ({ type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] });

// The project's standard work type for changes and, when it has one, Bug for the incidents.
export async function sampleTypes(request, projectKey) {
  const meta = await request('GET', `/rest/api/3/issue/createmeta/${projectKey}/issuetypes`);
  const types = (meta?.issueTypes || meta?.values || []).filter((t) => !t.subtask);
  const named = (n) => types.find((t) => (t.untranslatedName || t.name) === n);
  const base = named('Task') || types.find((t) => t.hierarchyLevel === 0) || types[0];
  if (!base) throw new Error(`No work type in ${projectKey} can be created.`);
  return { change: base.id, incident: (named('Bug') || base).id };
}

export async function moveToDone(request, key) {
  const t = await request('GET', `/rest/api/3/issue/${key}/transitions`);
  const done = (t?.transitions || []).find((x) => x.to?.statusCategory?.key === 'done');
  if (!done) return false;
  await request('POST', `/rest/api/3/issue/${key}/transitions`, { transition: { id: done.id } });
  return true;
}

export async function seedSample(request, projectKey, now = new Date().toISOString()) {
  const types = await sampleTypes(request, projectKey);
  const create = async (typeId, s) => {
    const res = await request('POST', '/rest/api/3/issue', {
      fields: { project: { key: projectKey }, issuetype: { id: typeId }, summary: s.summary, labels: [...s.labels, SAMPLE_LABEL], description: doc(s.description) },
    });
    return res.key;
  };
  const changes = [];
  for (const c of SAMPLE_CHANGES) {
    const key = await create(types.change, c);
    await request('PUT', `/rest/api/3/issue/${key}/properties/${PROPERTY}`, { deployedAt: addMinutes(now, c.deployedMin), ...(c.risk ? { risk: c.risk } : {}) });
    await moveToDone(request, key);
    changes.push(key);
  }
  const incidents = [];
  for (const i of SAMPLE_INCIDENTS) {
    const key = await create(types.incident, i);
    await request('PUT', `/rest/api/3/issue/${key}/properties/${PROPERTY}`, { startedAt: addMinutes(now, i.startedMin) });
    incidents.push(key);
  }
  return { changes, incidents };
}
