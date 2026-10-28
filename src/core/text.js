// Plain text from Atlassian Document Format, and the word statistics the ranking uses.

const BLOCKS = new Set(['paragraph', 'heading', 'listItem', 'codeBlock', 'blockquote', 'tableCell', 'tableHeader']);

export function adfText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.type === 'text') return node.text || '';
  if (node.type === 'hardBreak') return '\n';
  if (node.type === 'mention') return node.attrs?.text || '';
  const inner = (node.content || []).map(adfText).join(BLOCKS.has(node.type) ? '' : ' ');
  return BLOCKS.has(node.type) ? `${inner.trim()}\n` : inner;
}

const STOP = new Set(`a about above after again against all also am an and any are as at be because been before being
below between both but by can could did do does doing down during each few for from further had has have having he her
here hers him his how i if in into is it its itself just me more most my no nor not now of off on once only or other our
ours out over own same she should since so some such than that the their them then there these they this those through
to too under until up very was we were what when where which while who whom why will with would you your yours
please thanks issue ticket error problem fail fails failed failing fix fixed add added update updated change changed new
use used using make made work works working see seen get got set via per today yesterday customer user team still instead
now then about around show shown`.split(/\s+/));

function stem(t) {
  if (t.length > 4 && t.endsWith('ies')) return `${t.slice(0, -3)}y`;
  if (t.length > 3 && t.endsWith('s') && !/(ss|us|is)$/.test(t)) return t.slice(0, -1);
  return t;
}

// Two-word forms people write either way, so "time out" in an incident matches "timeout" in a change.
const PHRASES = [[/\b(time[sd]?|timing)[\s-]+out\b/g, 'timeout'], [/\b(roll(ed)?|rolling)[\s-]+back\b/g, 'rollback'],
  [/\b(log(ged)?|sign(ed)?)[\s-]+in\b/g, 'login'], [/\bset[\s-]+up\b/g, 'setup']];

export function termsOf(text) {
  const out = new Set();
  let s = String(text || '').toLowerCase();
  for (const [re, word] of PHRASES) s = s.replace(re, word);
  for (const raw of s.split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || /^\d+$/.test(raw) || STOP.has(raw)) continue;
    const t = stem(raw);
    if (!STOP.has(t)) out.add(t);
  }
  return out;
}

// Rarer words count for more: idf = ln((n + 1) / (df + 1)) + 1 over the incident and its candidate changes.
export function idfTable(docs) {
  const df = new Map();
  for (const d of docs) for (const t of d) df.set(t, (df.get(t) || 0) + 1);
  const idf = new Map();
  for (const [t, c] of df) idf.set(t, Math.log((docs.length + 1) / (c + 1)) + 1);
  return idf;
}

// Cosine similarity of two word sets with idf weights, and the shared words, rarest first.
export function similarity(a, b, idf) {
  let both = 0;
  let na = 0;
  let nb = 0;
  const common = [];
  for (const t of a) {
    const w = idf.get(t) || 1;
    na += w * w;
    if (b.has(t)) {
      both += w * w;
      common.push([t, w]);
    }
  }
  for (const t of b) nb += (idf.get(t) || 1) ** 2;
  if (!na || !nb) return { score: 0, terms: [] };
  common.sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
  return { score: both / Math.sqrt(na * nb), terms: common.map(([t]) => t) };
}
