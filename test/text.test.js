import test from 'node:test';
import assert from 'node:assert/strict';
import { adfText, termsOf, idfTable, similarity } from '../src/core/text.js';

test('ADF to text keeps paragraphs apart', () => {
  const doc = { type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Card payments' }, { type: 'hardBreak' }, { type: 'text', text: 'time out' }] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'PayPal works' }] }] }] },
  ] };
  assert.equal(adfText(doc).trim(), 'Card payments\ntime out\n PayPal works');
});

test('terms drop stop words, numbers and plural endings', () => {
  assert.deepEqual([...termsOf('Card payments time out after 30 seconds; PayPal still works')].sort(), ['card', 'payment', 'paypal', 'second', 'timeout']);
  assert.ok(termsOf('timeouts').has('timeout'));
  assert.ok(termsOf('the request timed out').has('timeout'));
  assert.ok(termsOf('Rolled back the release').has('rollback'));
  assert.ok(termsOf('libraries').has('library'));
  assert.ok(termsOf('status').has('status'));
});

test('rare shared words weigh more', () => {
  const a = termsOf('card payment gateway timeout');
  const b = termsOf('lower the card payment gateway timeout');
  const c = termsOf('rename search filters');
  const idf = idfTable([a, b, c]);
  const ab = similarity(a, b, idf);
  assert.ok(ab.score > 0.8);
  assert.deepEqual(similarity(a, c, idf), { score: 0, terms: [] });
  assert.equal(ab.terms.length, 4);
});
