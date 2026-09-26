const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../assets/crema.js');

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('dilute 300 g at 1.50% to 1.30% → add 46.15 g water', () => {
  const r = C.adjustStrength({ mass: 300, tds: 1.5, target: 1.3 });
  close(r.add, 300 * (1.5 / 1.3 - 1));
  close(r.finalTds, 1.3);
});

test('strengthen 300 g at 1.10% to 1.30% with 9% espresso', () => {
  const r = C.adjustStrength({ mass: 300, tds: 1.1, target: 1.3, addTds: 9 });
  close(r.add, 300 * 0.2 / 7.7);
  close(r.finalTds, 1.3);
});

test('mass balance holds across a sweep', () => {
  for (const [m, t1, t2, ta] of [[250, 1.4, 1.2, 0], [40, 10, 1.35, 0], [500, 1.0, 1.25, 1.6]]) {
    const r = C.adjustStrength({ mass: m, tds: t1, target: t2, addTds: ta });
    assert.ok(r.add > 0);
    close(r.finalTds, t2);
  }
});

test('equal target needs nothing', () => {
  assert.equal(C.adjustStrength({ mass: 300, tds: 1.3, target: 1.3 }).add, 0);
});

test('unreachable targets throw', () => {
  assert.throws(() => C.adjustStrength({ mass: 300, tds: 1.2, target: 1.4 }), e => e.code === 'unreachable');
  assert.throws(() => C.adjustStrength({ mass: 300, tds: 1.2, target: 1.5, addTds: 1.4 }), e => e.code === 'unreachable');
  assert.throws(() => C.adjustStrength({ mass: 300, tds: 1.2, target: 0, addTds: 0 }), e => e.code === 'unreachable');
});
