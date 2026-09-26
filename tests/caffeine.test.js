const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../assets/crema.js');

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('20 g arabica pourover → 216 mg (1.2% × 90%)', () => {
  const r = C.estimateCaffeine({ dose: 20, species: 'arabica', method: 'pourover' });
  close(r.mg, 216);
  close(r.low, 20000 * 0.009 * 0.8);
  close(r.high, 20000 * 0.015 * 1.0);
});

test('robusta share blends linearly', () => {
  const a = C.estimateCaffeine({ dose: 18, method: 'espresso', robustaShare: 0 });
  const b = C.estimateCaffeine({ dose: 18, method: 'espresso', robustaShare: 1 });
  const h = C.estimateCaffeine({ dose: 18, method: 'espresso', robustaShare: 0.5 });
  close(h.mg, (a.mg + b.mg) / 2);
});

test('decaf is small, low ≤ mid ≤ high everywhere', () => {
  const d = C.estimateCaffeine({ dose: 20, species: 'decaf', method: 'pourover' });
  assert.ok(d.mg < 20);
  for (const method of Object.keys(C.CAFFEINE_TRANSFER)) {
    for (const s of [0, 0.3, 1]) {
      const r = C.estimateCaffeine({ dose: 15, method, robustaShare: s });
      assert.ok(r.low <= r.mg && r.mg <= r.high, method);
    }
  }
});

test('validation', () => {
  assert.throws(() => C.estimateCaffeine({ dose: 20, method: 'percolator' }), RangeError);
  assert.throws(() => C.estimateCaffeine({ dose: 0, method: 'pourover' }), RangeError);
});
