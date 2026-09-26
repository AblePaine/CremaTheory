const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../assets/crema.js');

const close = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('SCA target water, 50/50 Ca:Mg, baking soda — hand-worked', () => {
  const r = C.waterRecipe({ alkalinity: 40, hardness: 68, mgShare: 0.5, liters: 1 });
  // n_HCO3 = 40 / 50.043 = 0.79931 mmol/L
  close(r.mmol.HCO3, 0.79931, 1e-5);
  // NaHCO3 = 0.79931 * 84.006 / 1000 = 0.067147 g
  close(r.perLiter.buffer, 0.067147, 1e-5);
  // n_hard = 68 / 100.086 = 0.679416; half each = 0.339708
  close(r.mmol.Ca, 0.339708, 1e-5);
  close(r.mmol.Mg, 0.339708, 1e-5);
  close(r.perLiter.epsom, 0.339708 * 246.466 / 1000, 1e-6);   // 0.083727
  close(r.perLiter.gypsum, 0.339708 * 172.164 / 1000, 1e-6);  // 0.058485
  close(r.ions.Na, 18.376, 1e-2);
  close(r.ions.HCO3, 48.771, 1e-2);
  close(r.ions.Ca, 13.615, 1e-2);
  close(r.ions.Mg, 8.257, 1e-2);
  close(r.ions.SO4, 65.263, 1e-2);
  close(r.tds.ionSum, 154.28, 2e-2);
  assert.equal(r.ions.K, 0);
});

test('round trip: ions back to hardness and alkalinity', () => {
  for (const [alk, hard, s] of [[40, 68, 0.5], [20, 85, 1], [0, 17, 0], [75, 40, 0.3]]) {
    const r = C.waterRecipe({ alkalinity: alk, hardness: hard, mgShare: s });
    const back = C.waterFromIons(r.ions);
    close(back.alkalinity, alk, 1e-9);
    close(back.hardness, hard, 1e-9);
  }
});

test('charge balance: cations equal anions in meq/L', () => {
  const r = C.waterRecipe({ alkalinity: 55, hardness: 70, mgShare: 0.35 });
  const M = C.MOLAR;
  const cat = 2 * r.ions.Ca / M.Ca + 2 * r.ions.Mg / M.Mg + r.ions.Na / M.Na + r.ions.K / M.K;
  const an = r.ions.HCO3 / M.HCO3 + 2 * r.ions.SO4 / M.SO4;
  close(cat, an, 1e-9);
});

test('mass balance: ion sum = salts added minus hydrate water', () => {
  const r = C.waterRecipe({ alkalinity: 40, hardness: 68, mgShare: 0.6 });
  const M = C.MOLAR;
  const hydrate = (r.mmol.Mg * 7 + r.mmol.Ca * 2) * M.H2O; // mg/L
  const saltsMg = (r.perLiter.buffer + r.perLiter.epsom + r.perLiter.gypsum) * 1000;
  close(r.tds.ionSum, saltsMg - hydrate, 1e-9);
});

test('evaporated TDS counts bicarbonate at 0.4917', () => {
  const r = C.waterRecipe({ alkalinity: 40, hardness: 0, mgShare: 0 });
  close(r.tds.ionSum - r.tds.evaporated, r.ions.HCO3 * (1 - 60.008 / 122.032), 1e-3);
});

test('potassium bicarbonate swaps Na for K, same HCO3', () => {
  const na = C.waterRecipe({ alkalinity: 40, hardness: 68, mgShare: 0.5 });
  const k = C.waterRecipe({ alkalinity: 40, hardness: 68, mgShare: 0.5, buffer: 'KHCO3' });
  assert.equal(k.ions.Na, 0);
  close(k.ions.K, 0.79931 * 39.098, 1e-3);
  close(k.ions.HCO3, na.ions.HCO3, 1e-12);
  close(k.perLiter.buffer, 0.79931 * 100.114 / 1000, 1e-6);
});

test('batch scales linearly and flags sub-resolution weighings', () => {
  const r4 = C.waterRecipe({ alkalinity: 40, hardness: 68, mgShare: 0.5, liters: 4 });
  close(r4.batch.epsom, 4 * r4.perLiter.epsom, 1e-12);
  // 1 L of SCA-target water needs < 0.1 g of every salt
  const r = C.waterRecipe({ alkalinity: 40, hardness: 68, mgShare: 0.5, liters: 1 });
  assert.ok(r.warnings.some(w => w.code === 'below-scale'));
  assert.ok(r.warnings.some(w => w.code === 'sodium-over-sca'));
  const big = C.waterRecipe({ alkalinity: 40, hardness: 68, mgShare: 0.5, liters: 20 });
  assert.ok(!big.warnings.some(w => w.code === 'below-scale'));
});

test('input validation', () => {
  assert.throws(() => C.waterRecipe({ alkalinity: -1, hardness: 68, mgShare: 0.5 }), RangeError);
  assert.throws(() => C.waterRecipe({ alkalinity: 40, hardness: 68, mgShare: 1.2 }), RangeError);
  assert.throws(() => C.waterRecipe({ alkalinity: 40, hardness: 68, mgShare: 0.5, liters: 0 }), RangeError);
  assert.throws(() => C.waterRecipe({ alkalinity: 40, hardness: 68, mgShare: 0.5, buffer: 'CaCO3' }), RangeError);
});
