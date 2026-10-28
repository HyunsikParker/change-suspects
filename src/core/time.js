// Times are ISO 8601 strings; all arithmetic is in milliseconds since the epoch.
export const WINDOWS = [24, 72, 168];
export const DEFAULT_WINDOW = 72;
const HOUR = 3600000;
const DAY = 24 * HOUR;

export function toMs(iso) {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

export const addMinutes = (iso, minutes) => new Date(toMs(iso) + minutes * 60000).toISOString();

// "35 min", "3 h 10 min", "26 h", "2 days 4 h"
export function spanText(minutes) {
  const m = Math.abs(Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h < 10) return r ? `${h} h ${r} min` : `${h} h`;
  if (h < 48) return `${h} h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d} days ${rh} h` : `${d} days`;
}

export const windowText = (hours) => (hours < 48 ? `${hours} hours` : `${Math.round(hours / 24)} days`);

// Date bounds for JQL with a day of margin on each side; the exact window is applied in code,
// because JQL dates are read in the searching user's time zone.
export function jqlDates(startIso, windowHours, nowIso = new Date().toISOString()) {
  const start = toMs(startIso);
  const d = (ms) => new Date(ms).toISOString().slice(0, 10);
  return { from: d(start - windowHours * HOUR - DAY), to: d(Math.max(start, toMs(nowIso)) + DAY) };
}

// Wall-clock date and time in an IANA time zone, and back, so a start time is entered in the same zone Jira
// shows it in.
function offsetMinutes(ms, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ms) / 60000;
}

export function zonedParts(iso, timeZone) {
  const ms = toMs(iso);
  const local = new Date(ms + offsetMinutes(ms, timeZone) * 60000).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

export function zonedToIso(date, time, timeZone) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let ms = wall - offsetMinutes(wall, timeZone) * 60000;
  ms = wall - offsetMinutes(ms, timeZone) * 60000;
  return new Date(ms).toISOString();
}
