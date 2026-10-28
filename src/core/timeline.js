// The incident timeline as a Jira comment: changes in the window, the start, the report and what changed after.
import { toMs } from './time.js';

// Weak matches stay out of the timeline unless the team marked one; `omitted` says how many were left out.
export function timelineEvents(incident, ranking, marked = []) {
  const listed = ranking.before.filter((c) => c.band !== 'weak' || marked.includes(c.key));
  const events = listed.map((c) => ({ at: c.changedAt, kind: 'change', key: c.key, summary: c.summary, source: c.timeSource, band: c.band, marked: marked.includes(c.key) }));
  events.push({ at: incident.startedAt, kind: 'start', key: incident.key, summary: incident.summary });
  if (incident.created && incident.created !== incident.startedAt) events.push({ at: incident.created, kind: 'reported', key: incident.key });
  for (const c of ranking.after) events.push({ at: c.changedAt, kind: 'after', key: c.key, summary: c.summary, source: c.timeSource });
  events.sort((a, b) => toMs(a.at) - toMs(b.at));
  events.omitted = ranking.before.length - listed.length;
  return events;
}

const when = (iso, timeZone) => new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

const text = (t, marks) => (marks ? { type: 'text', text: t, marks } : { type: 'text', text: t });
const keyLink = (key, siteUrl) => text(key, siteUrl ? [{ type: 'link', attrs: { href: `${siteUrl}/browse/${key}` } }] : undefined);

function line(e, timeZone, siteUrl) {
  const parts = [text(`${when(e.at, timeZone)}  `, [{ type: 'strong' }])];
  if (e.kind === 'start') parts.push(text('Incident started'));
  else if (e.kind === 'reported') parts.push(text('Incident reported'));
  else {
    parts.push(keyLink(e.key, siteUrl), text(` ${e.summary} (${e.source}`));
    if (e.kind === 'after') parts.push(text(', after the start'));
    if (e.kind === 'change' && e.band !== 'weak') parts.push(text(`, ${e.band} suspect`));
    parts.push(text(')'));
    if (e.marked) parts.push(text(' - marked as suspected cause', [{ type: 'strong' }]));
  }
  return { type: 'listItem', content: [{ type: 'paragraph', content: parts }] };
}

export function timelineAdf(events, { timeZone = 'UTC', siteUrl = '', windowText = '' } = {}) {
  return {
    type: 'doc',
    version: 1,
    content: [
      { type: 'paragraph', content: [text(`Timeline from Change Suspects, ${windowText ? `changes in the ${windowText} before the start, ` : ''}times in ${timeZone}:`)] },
      { type: 'bulletList', content: events.map((e) => line(e, timeZone, siteUrl)) },
      ...(events.omitted ? [{ type: 'paragraph', content: [text(`${events.omitted} other change${events.omitted === 1 ? '' : 's'} in the window matched only weakly and are not listed.`)] }] : []),
    ],
  };
}
