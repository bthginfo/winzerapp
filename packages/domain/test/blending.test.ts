import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planBlend, type Source } from '../src/blending.js';
const sources: Source[] = [
  { id: 'A', volume: '600', available: '1200', cost: '2', alcohol: '12', method: 'example-compatible', blocked: false },
  { id: 'B', volume: '400', available: '900', cost: '3', alcohol: '13.5', method: 'example-compatible', blocked: false }
];
test('specification 60/40 example and 250 ml trial', () => {
  const r = planBlend(sources);
  assert.equal(r.volume, '1000.000'); assert.equal(r.cost, '2400.00');
  assert.equal(r.costPerLiter, '2.40'); assert.equal(r.alcohol, '12.60');
  assert.deepEqual(r.samples.map(s => s.ml), ['150.00', '100.00']);
  assert.equal(r.ph, null);
});
test('missing and incompatible analyses never become zero', () => {
  assert.equal(planBlend(sources.map(s => ({ ...s, alcohol: null }))).alcohol, null);
  assert.equal(planBlend(sources.map((s, i) => ({ ...s, method: String(i) }))).alcohol, null);
});
test('blocked sources, unavailable volumes and duplicate references fail', () => {
  assert.throws(() => planBlend(sources.map(s => ({ ...s, blocked: true }))), /BLOCKED_SOURCE/);
  assert.throws(() => planBlend(sources.map(s => ({ ...s, available: '500' }))), /INSUFFICIENT_STOCK/);
  assert.throws(() => planBlend([sources[0], sources[0]]), /DUPLICATE_SOURCE/);
});
test('invalid and empty amounts fail', () => {
  for (const volume of ['-1', 'NaN', 'Infinity', '1e4', '1,5', '']) {
    assert.throws(() => planBlend([{ ...sources[0], volume }]), /INVALID_DECIMAL/);
  }
  assert.throws(() => planBlend([{ ...sources[0], volume: '0' }]), /EMPTY_RECIPE/);
});
test('trial rounding preserves exact total', () => {
  const r = planBlend(['A', 'B', 'C'].map(id => ({ ...sources[0], id, volume: '1' })));
  assert.deepEqual(r.samples.map(s => s.ml), ['83.33', '83.33', '83.34']);
});
