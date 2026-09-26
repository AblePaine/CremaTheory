// Molar masses must come from the shared atomic-weight table and agree with
// hand-computed sums to the precision of that table.
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../assets/crema.js');

const close = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('atomic weights match the shared table', () => {
  assert.deepEqual({ ...C.ATOMIC_WEIGHTS }, {
    N: 14.007, O: 15.999, Na: 22.990, K: 39.098, Mg: 24.305,
    Ca: 40.078, S: 32.06, C: 12.011, H: 1.008, Cl: 35.45
  });
});

test('molar masses (hand sums)', () => {
  close(C.MOLAR.H2O, 18.015);
  close(C.MOLAR.HCO3, 61.016);
  close(C.MOLAR.CO3, 60.008);
  close(C.MOLAR.SO4, 96.056);
  close(C.MOLAR.CaCO3, 100.086);
  close(C.MOLAR.NaHCO3, 84.006);
  close(C.MOLAR.KHCO3, 100.114);
  close(C.MOLAR.MgSO4_7H2O, 246.466);
  close(C.MOLAR.CaSO4_2H2O, 172.164);
  close(C.CACO3_EQ, 50.043);
});

test('unknown element is rejected', () => {
  assert.throws(() => C.molarMass({ Fe: 1 }));
});
