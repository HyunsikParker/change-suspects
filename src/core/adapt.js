// Turns Jira issue JSON (fields plus the app's issue property) into the incident and change records the
// ranking works on. The property is optional: without it an incident starts when it was created and a change
// counts from when it was resolved.
import { adfText } from './text.js';

export const PROPERTY = 'change-suspects';
export const FIELDS = ['summary', 'description', 'labels', 'components', 'created', 'resolutiondate', 'status', 'issuetype', 'project'];

const isIncidentType = (name) => /incident/i.test(name || '');
const textOf = (f) => `${f.summary || ''}\n${adfText(f.description)}`.slice(0, 4000);

export function isIncident(issue) {
  const f = issue.fields || {};
  return isIncidentType(f.issuetype?.name) || (f.labels || []).some((l) => l.toLowerCase() === 'incident');
}

// Service projects hold requests of every kind; only their change requests count as changes there.
export function isChangeCandidate(issue) {
  const f = issue.fields || {};
  if (isIncident(issue) || f.issuetype?.subtask) return false;
  if (f.project?.projectTypeKey === 'service_desk') return /change/i.test(f.issuetype?.name || '');
  return true;
}

export function toIncident(issue) {
  const f = issue.fields || {};
  const prop = issue.properties?.[PROPERTY] || {};
  return {
    key: issue.key,
    summary: f.summary || '',
    text: textOf(f),
    components: (f.components || []).map((c) => c.name),
    labels: f.labels || [],
    created: f.created,
    startedAt: prop.startedAt || f.created,
    startSource: prop.startedAt ? 'set' : 'created',
    marked: Array.isArray(prop.marked) ? prop.marked : [],
    status: f.status?.name || '',
    project: f.project?.key || '',
  };
}

export function toChange(issue, riskFieldId) {
  const f = issue.fields || {};
  const prop = issue.properties?.[PROPERTY] || {};
  const risk = prop.risk || (riskFieldId && f[riskFieldId]?.value) || null;
  return {
    key: issue.key,
    summary: f.summary || '',
    text: textOf(f),
    components: (f.components || []).map((c) => c.name),
    labels: f.labels || [],
    changedAt: prop.deployedAt || f.resolutiondate || null,
    timeSource: prop.deployedAt ? 'deployed' : 'resolved',
    risk,
    issueType: f.issuetype?.name || '',
    status: f.status?.name || '',
    project: f.project?.key || '',
  };
}
