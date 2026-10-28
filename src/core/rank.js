// Ranks the changes made before an incident started. Every suspect carries the evidence behind its place:
// how long before the start it went in, the components and labels it shares with the incident, the words
// the two descriptions share and the change risk when one is recorded.
import { toMs, spanText } from './time.js';
import { termsOf, idfTable, similarity } from './text.js';

const IGNORED_LABELS = new Set(['incident', 'change-suspects-sample']);
const RISK_BONUS = { high: 0.1, critical: 0.15, 'very high': 0.15 };
export const BANDS = { strong: 0.6, possible: 0.25 };

const norm = (s) => String(s || '').trim().toLowerCase();
const round = (x) => Math.round(x * 100) / 100;
const sharedNames = (a = [], b = []) => {
  const theirs = new Set(b.map(norm));
  return a.filter((x) => theirs.has(norm(x)));
};

// 1 for a change that went in just before, 0.5 at six hours, 0.2 at a day, 0.08 at three days.
export const recency = (hours) => 1 / (1 + hours / 6);

export function rankChanges(incident, candidates, { windowHours = 72, now = new Date().toISOString() } = {}) {
  const start = toMs(incident.startedAt);
  const from = start - windowHours * 3600000;
  const nowMs = toMs(now);
  const pool = candidates.filter((c) => c.key !== incident.key && toMs(c.changedAt) !== null);
  const incidentTerms = termsOf(incident.text);
  const docs = pool.map((c) => termsOf(c.text));
  const idf = idfTable([incidentTerms, ...docs]);
  const before = [];
  const after = [];
  pool.forEach((c, i) => {
    const t = toMs(c.changedAt);
    if (t > start) {
      if (t <= nowMs) after.push({ ...c, minutesAfter: Math.round((t - start) / 60000) });
      return;
    }
    if (t < from) return;
    const minutesBefore = Math.round((start - t) / 60000);
    const sharedComponents = sharedNames(c.components, incident.components);
    const sharedLabels = sharedNames(c.labels, incident.labels).filter((l) => !IGNORED_LABELS.has(norm(l)));
    const text = similarity(incidentTerms, docs[i], idf);
    const sameService = sharedComponents.length + sharedLabels.length > 0 ? 1 : 0;
    const relevance = 0.15 + 0.5 * sameService + 0.35 * Math.min(1, text.score / 0.5) + (RISK_BONUS[norm(c.risk)] || 0);
    const score = recency(minutesBefore / 60) * relevance;
    const band = score >= BANDS.strong ? 'strong' : score >= BANDS.possible ? 'possible' : 'weak';
    before.push({ ...c, minutesBefore, sharedComponents, sharedLabels, sharedTerms: text.terms.slice(0, 4), textScore: round(text.score), score: round(score), band });
  });
  before.sort((a, b) => b.score - a.score || a.minutesBefore - b.minutesBefore || a.key.localeCompare(b.key));
  after.sort((a, b) => a.minutesAfter - b.minutesAfter || a.key.localeCompare(b.key));
  return { startedAt: incident.startedAt, windowHours, from: new Date(from).toISOString(), before, after: after.slice(0, 10) };
}

// The evidence in words, in the order a responder would weigh it.
export function reasons(s) {
  const out = [`${s.timeSource === 'deployed' ? 'Deployed' : 'Resolved'} ${spanText(s.minutesBefore)} before the start`];
  if (s.sharedComponents.length) out.push(`Same component: ${s.sharedComponents.join(', ')}`);
  if (s.sharedLabels.length) out.push(`Same label: ${s.sharedLabels.join(', ')}`);
  if (s.sharedTerms.length) out.push(`Shared words: ${s.sharedTerms.join(', ')}`);
  if (s.risk) out.push(`Change risk: ${s.risk}`);
  return out;
}
