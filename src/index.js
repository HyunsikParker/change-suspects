import Resolver from '@forge/resolver';
import { addComment, candidateChanges, causeLinkType, incident as loadIncident, linkCause, myTimeZone, request, search, setProperty, siteUrl, unlinkCause } from './jira.js';
import { isIncident, toIncident } from './core/adapt.js';
import { rankChanges, reasons } from './core/rank.js';
import { timelineAdf, timelineEvents } from './core/timeline.js';
import { seedSample } from './core/seed.js';
import { SAMPLE_LABEL } from './core/sample.js';
import { DEFAULT_WINDOW, WINDOWS, spanText, toMs, windowText } from './core/time.js';

const KEY = /^[A-Z][A-Z0-9_]+-\d+$/;
const windowOf = (h) => (WINDOWS.includes(Number(h)) ? Number(h) : DEFAULT_WINDOW);

async function analyse(issueKey, windowHours) {
  const { issue, incident, siteUrl } = await loadIncident(issueKey);
  const changes = await candidateChanges(incident.startedAt, windowHours);
  const ranking = rankChanges(incident, changes, { windowHours });
  return { issue, incident, siteUrl, ranking };
}

// What the panel and the tools show for one change; descriptions stay on the server.
const view = (c, siteUrl) => ({
  key: c.key, summary: c.summary, url: `${siteUrl}/browse/${c.key}`, project: c.project, status: c.status, issueType: c.issueType,
  changedAt: c.changedAt, timeSource: c.timeSource, risk: c.risk, band: c.band, score: c.score,
  minutesBefore: c.minutesBefore, minutesAfter: c.minutesAfter, why: c.band ? reasons(c) : undefined,
});

const panelData = async (issueKey, windowHours) => {
  const { issue, incident, siteUrl, ranking } = await analyse(issueKey, windowHours);
  const [type, timeZone] = await Promise.all([causeLinkType(), myTimeZone()]);
  return {
    timeZone,
    incident: { key: incident.key, summary: incident.summary, startedAt: incident.startedAt, startSource: incident.startSource, created: incident.created, isIncident: isIncident(issue) },
    windowHours,
    windowText: windowText(windowHours),
    suspects: ranking.before.map((c) => view(c, siteUrl)),
    after: ranking.after.map((c) => view(c, siteUrl)),
    marked: incident.marked,
    linkType: type,
  };
};

const resolver = new Resolver();

resolver.define('getPanel', async ({ payload, context }) => panelData(context.extension.issue.key, windowOf(payload.windowHours)));

resolver.define('setStart', async ({ payload, context }) => {
  const key = context.extension.issue.key;
  const ms = toMs(payload.startedAt);
  if (ms === null) return { ok: false, error: 'Pick a date and a time.' };
  if (ms > Date.now() + 60000) return { ok: false, error: 'The start cannot be in the future.' };
  const { incident } = await loadIncident(key);
  await setProperty(key, { startedAt: new Date(ms).toISOString(), marked: incident.marked });
  return { ok: true };
});

async function mark(incidentKey, changeKey) {
  const { issue, incident } = await loadIncident(incidentKey);
  if (incident.marked.includes(changeKey)) return { ok: true, already: true };
  const type = await causeLinkType();
  await linkCause(changeKey, incidentKey, type);
  const prop = issue.properties?.['change-suspects'] || {};
  await setProperty(incidentKey, { ...prop, marked: [...incident.marked, changeKey] });
  return { ok: true, linked: `${changeKey} and ${incidentKey} are now linked with the "${type.name}" link type.` };
}

resolver.define('mark', async ({ payload, context }) => mark(context.extension.issue.key, String(payload.changeKey)));

resolver.define('unmark', async ({ payload, context }) => {
  const key = context.extension.issue.key;
  const changeKey = String(payload.changeKey);
  const { issue, incident } = await loadIncident(key);
  const type = await causeLinkType();
  await unlinkCause(issue, changeKey, type.name);
  const prop = issue.properties?.['change-suspects'] || {};
  await setProperty(key, { ...prop, marked: incident.marked.filter((k) => k !== changeKey) });
  return { ok: true };
});

resolver.define('postTimeline', async ({ payload, context }) => {
  const key = context.extension.issue.key;
  const windowHours = windowOf(payload.windowHours);
  const { incident, siteUrl, ranking } = await analyse(key, windowHours);
  const timeZone = await myTimeZone();
  const body = timelineAdf(timelineEvents(incident, ranking, incident.marked), { timeZone, siteUrl, windowText: windowText(windowHours) });
  await addComment(key, body);
  return { ok: true, events: body.content[1].content.length, timeZone };
});

// Incidents created in the project in the last 30 days, each with its strongest suspect. One search covers the
// changes for all of them.
async function projectIncidents(projectKey) {
  const jql = (types) => `project = "${projectKey}" AND (${types}labels = incident) AND created >= -30d ORDER BY created DESC`;
  const issues = await search(jql('issuetype in ("Incident", "[System] Incident") OR '), { max: 10 }).catch(() => search(jql(''), { max: 10 }));
  if (issues.length === 0) return [];
  const incidents = issues.map(toIncident);
  const earliest = incidents.reduce((a, i) => (toMs(i.startedAt) < toMs(a) ? i.startedAt : a), incidents[0].startedAt);
  const [changes, base] = await Promise.all([candidateChanges(earliest, DEFAULT_WINDOW), siteUrl()]);
  return incidents.map((inc) => {
    const r = rankChanges(inc, changes, { windowHours: DEFAULT_WINDOW });
    return {
      key: inc.key, summary: inc.summary, url: `${base}/browse/${inc.key}`, status: inc.status, startedAt: inc.startedAt, startSource: inc.startSource,
      top: r.before[0] ? view(r.before[0], base) : null, strong: r.before.filter((c) => c.band === 'strong').length, considered: r.before.length,
      marked: inc.marked,
    };
  });
}

resolver.define('getProject', async ({ context }) => {
  const projectKey = context.extension.project.key;
  const incidents = await projectIncidents(projectKey);
  const sample = await search(`project = "${projectKey}" AND labels = "${SAMPLE_LABEL}"`, { max: 1, fields: ['summary'] });
  return { projectKey, incidents, hasSample: sample.length > 0, windowText: windowText(DEFAULT_WINDOW), timeZone: await myTimeZone() };
});

resolver.define('loadSample', async ({ context }) => {
  const projectKey = context.extension.project.key;
  const existing = await search(`project = "${projectKey}" AND labels = "${SAMPLE_LABEL}"`, { max: 1, fields: ['summary'] });
  if (existing.length) return { ok: false, error: 'The sample is already in this project.' };
  try {
    return { ok: true, ...(await seedSample(request, projectKey)) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

export const handler = resolver.getDefinitions();

// Rovo actions and MCP tools share these handlers.
const keyFrom = (value, context) => String(value || context?.jira?.issueKey || '').trim().toUpperCase();

export async function listSuspectChanges(payload) {
  const issueKey = keyFrom(payload.issueKey, payload.context);
  if (!KEY.test(issueKey)) return { error: 'Provide the key of the incident work item, for example SHOP-21.' };
  const windowHours = windowOf(payload.windowHours);
  const d = await panelData(issueKey, windowHours);
  return {
    incident: d.incident.key,
    summary: d.incident.summary,
    startedAt: d.incident.startedAt,
    startedAtSource: d.incident.startSource === 'set' ? 'set by the team' : 'creation time of the work item',
    window: d.windowText,
    suspects: d.suspects.filter((c) => c.band !== 'weak' || d.marked.includes(c.key)).map(({ key, summary, url, band, why, changedAt }) => ({ key, summary, url, band, changedAt, why })),
    weakMatchesNotListed: d.suspects.filter((c) => c.band === 'weak' && !d.marked.includes(c.key)).length,
    changesAfterStart: d.after.map(({ key, summary, url, changedAt, minutesAfter }) => ({ key, summary, url, changedAt, after: spanText(minutesAfter) })),
    markedAsSuspectedCause: d.marked,
  };
}

export async function markSuspectChange(payload) {
  const incidentKey = keyFrom(payload.incidentKey, payload.context);
  const changeKey = String(payload.changeKey || '').trim().toUpperCase();
  if (!KEY.test(incidentKey) || !KEY.test(changeKey)) return { error: 'Provide the incident key and the change key, for example SHOP-21 and SHOP-14.' };
  if (incidentKey === changeKey) return { error: 'A work item cannot be its own cause.' };
  return mark(incidentKey, changeKey);
}

export async function listRecentIncidents(payload) {
  const projectKey = String(payload.projectKey || payload.context?.jira?.projectKey || '').trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]+$/.test(projectKey)) return { error: 'Provide a Jira project key, for example SHOP.' };
  const incidents = await projectIncidents(projectKey);
  return {
    project: projectKey,
    incidents: incidents.map((i) => ({
      key: i.key, summary: i.summary, url: i.url, status: i.status, startedAt: i.startedAt,
      topSuspect: i.top ? { key: i.top.key, summary: i.top.summary, band: i.top.band, why: i.top.why } : null,
      strongSuspects: i.strong, markedAsSuspectedCause: i.marked,
    })),
  };
}
