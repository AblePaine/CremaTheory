const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../assets/crema.js');

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('forward: 20 g at 1:16 → 320 g water, ~280 g in cup', () => {
  const r = C.scaleRatio({ ratio: 16, basis: 'water', dose: 20 });
  close(r.water, 320);
  close(r.beverageEstimate, 280);
});

test('reverse: 500 g water at 1:15 → 33.33 g dose', () => {
  const r = C.scaleRatio({ ratio: 15, basis: 'water', output: 500 });
  close(r.dose, 500 / 15);
});

test('espresso basis is beverage, no retention subtraction', () => {
  const r = C.scaleRatio({ ratio: 2, basis: 'beverage', dose: 18 });
  close(r.beverage, 36);
  assert.equal(r.beverageEstimate, undefined);
});

test('round trip forward then reverse', () => {
  for (const ratio of [2, 2.5, 15, 16.5, 17]) {
    const f = C.scaleRatio({ ratio, dose: 21.3 });
    close(C.scaleRatio({ ratio, output: f.output }).dose, 21.3);
  }
});

test('custom retention and clamp at zero', () => {
  close(C.scaleRatio({ ratio: 16, dose: 20, retention: 2.2 }).beverageEstimate, 276);
  assert.equal(C.scaleRatio({ ratio: 1, dose: 20 }).beverageEstimate, 0);
});

test('presets carry the right basis', () => {
  const p = Object.fromEntries(C.RATIO_PRESETS.map(x => [x.id, x]));
  assert.equal(p.po16.basis, 'water');
  assert.equal(p.esp2.basis, 'beverage');
  assert.deepEqual(C.RATIO_PRESETS.map(x => x.ratio), [15, 16, 17, 2]);
});
