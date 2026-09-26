const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../assets/crema.js');

const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('percolation: 1.35% × 300 g ÷ 18 g = 22.5%', () => {
  const r = C.extractionPercolation({ tds: 1.35, dose: 18, beverage: 300 });
  close(r.solids, 4.05);
  close(r.ey, 22.5);
  assert.equal(r.window, 'above');
  assert.equal(r.strength, 'within');
});

test('espresso: 9% × 36 g ÷ 18 g = 18%', () => {
  const r = C.extractionPercolation({ tds: 9, dose: 18, beverage: 36 });
  close(r.ey, 18);
  assert.equal(r.window, 'within');
});

test('immersion: T·W/(1−T) and the shortcut', () => {
  const r = C.extractionImmersion({ tds: 1.3, dose: 20, water: 300 });
  close(r.solids, 0.013 * 300 / 0.987);
  close(r.ey, 0.013 * 300 / 0.987 / 20 * 100);
  close(r.shortcutEy, 19.5);
  // the full formula always reads higher than the shortcut by 1/(1−T)
  close(r.ey / r.shortcutEy, 1 / 0.987);
});

test('immersion self-consistency: solution concentration equals input TDS', () => {
  const r = C.extractionImmersion({ tds: 1.42, dose: 15, water: 250 });
  close(r.solids / (250 + r.solids), 0.0142);
});

test('window edges are inclusive', () => {
  assert.equal(C.extractionPercolation({ tds: 1.2, dose: 20, beverage: 300 }).window, 'within'); // 18.0
  assert.equal(C.extractionPercolation({ tds: 1.2, dose: 20, beverage: 366.6666666666 }).window, 'within');
});

test('validation', () => {
  assert.throws(() => C.extractionPercolation({ tds: 0, dose: 18, beverage: 300 }), RangeError);
  assert.throws(() => C.extractionPercolation({ tds: 1.3, dose: 0, beverage: 300 }), RangeError);
  assert.throws(() => C.extractionImmersion({ tds: 1.3, dose: 18, water: NaN }), RangeError);
});
