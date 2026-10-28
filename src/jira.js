// Jira REST calls, all made as the current user so every result respects that user's permissions.
import api, { route, assumeTrustedRoute } from '@forge/api';
import { PROPERTY, FIELDS, isChangeCandidate, toChange, toIncident } from './core/adapt.js';
import { jqlDates } from './core/time.js';

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };
const MAX_CANDIDATES = 300;

async function call(path, options = {}) {
  const res = await api.asUser().requestJira(path, { headers: JSON_HEADERS, ...options });
  if (!res.ok) throw new Error(`Jira ${res.status}: ${(await res.text()).slice(0, 300)}`);
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// For the app's own constant paths (the sample loader); never pass user input as `path`.
export const request = (method, path, body) => call(assumeTrustedRoute(path), { method, body: body ? JSON.stringify(body) : undefined });

export async function search(jql, { fields = FIELDS, max = MAX_CANDIDATES } = {}) {
  const issues = [];
  let nextPageToken;
  do {
    const body = { jql, fields, properties: [PROPERTY], maxResults: Math.min(100, max - issues.length) };
    if (nextPageToken) body.nextPageToken = nextPageToken;
    const page = await call(route`/rest/api/3/search/jql`, { method: 'POST', body: JSON.stringify(body) });
    issues.push(...(page.issues || []));
    nextPageToken = page.nextPageToken;
  } while (nextPageToken && issues.length < max);
  return issues;
}

export async function getIssue(key) {
  return call(route`/rest/api/3/issue/${key}?fields=${FIELDS.join(',')},issuelinks&properties=${PROPERTY}`);
}

export async function setProperty(key, value) {
  await call(route`/rest/api/3/issue/${key}/properties/${PROPERTY}`, { method: 'PUT', body: JSON.stringify(value) });
}

// Jira Service Management names this field "Change risk"; other sites simply do not have it.
export async function riskFieldId() {
  const fields = await call(route`/rest/api/3/field`);
  return fields.find((f) => f.name === 'Change risk')?.id || null;
}

// Changes resolved, or recorded as deployed, between a few days before the start and now. The JQL window has a
// day of margin; the ranking applies the exact window. Sites where the property is not indexed yet fall back to
// resolution dates only.
export async function candidateChanges(startedAt, windowHours) {
  const { from, to } = jqlDates(startedAt, windowHours);
  const resolved = `(resolved >= "${from}" AND resolved <= "${to}")`;
  const deployed = `(issue.property['${PROPERTY}'].deployedAt >= "${from}" AND issue.property['${PROPERTY}'].deployedAt <= "${to}")`;
  const risk = await riskFieldId();
  const fields = risk ? [...FIELDS, risk] : FIELDS;
  let issues;
  try {
    issues = await search(`${resolved} OR ${deployed} ORDER BY updated DESC`, { fields });
  } catch (e) {
    issues = await search(`${resolved} ORDER BY updated DESC`, { fields });
  }
  return issues.filter(isChangeCandidate).map((i) => toChange(i, risk));
}

// The site's own address for browse links; `self` URLs in API responses point at api.atlassian.com.
export async function siteUrl() {
  return (await call(route`/rest/api/3/serverInfo`)).baseUrl;
}

export async function incident(key) {
  const [issue, base] = await Promise.all([getIssue(key), siteUrl()]);
  return { issue, incident: toIncident(issue), siteUrl: base };
}

// Prefers a link type that says "causes" (Jira Service Management's Problem/Incident type); otherwise Relates.
export async function causeLinkType() {
  const { issueLinkTypes = [] } = await call(route`/rest/api/3/issueLinkType`);
  const causes = issueLinkTypes.find((t) => /caus/i.test(`${t.inward} ${t.outward}`));
  if (causes) return { name: causes.name, causes: true, outward: causes.outward, inward: causes.inward };
  const relates = issueLinkTypes.find((t) => t.name === 'Relates') || issueLinkTypes[0];
  return { name: relates.name, causes: false, outward: relates.outward, inward: relates.inward };
}

// The change goes on the "causes" side and the incident on the "is caused by" side.
export async function linkCause(changeKey, incidentKey, type) {
  await call(route`/rest/api/3/issueLink`, {
    method: 'POST',
    body: JSON.stringify({ type: { name: type.name }, outwardIssue: { key: incidentKey }, inwardIssue: { key: changeKey } }),
  });
}

export async function unlinkCause(issue, changeKey, typeName) {
  const links = (issue.fields.issuelinks || []).filter((l) => l.type?.name === typeName && (l.inwardIssue?.key === changeKey || l.outwardIssue?.key === changeKey));
  for (const l of links) await call(route`/rest/api/3/issueLink/${l.id}`, { method: 'DELETE' });
  return links.length;
}

export async function addComment(key, body) {
  return call(route`/rest/api/3/issue/${key}/comment`, { method: 'POST', body: JSON.stringify({ body }) });
}

export async function myTimeZone() {
  return (await call(route`/rest/api/3/myself`)).timeZone || 'UTC';
}
