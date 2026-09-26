/*
 * CremaTheory shared formula module.
 *
 * Every engine on the site calls into this file. It runs unchanged in the
 * browser (exposes window.Crema) and in node (module.exports) so the test
 * suite exercises exactly the code the pages use.
 *
 * House rules for this file:
 *   - Every formula carries its derivation in a comment.
 *   - Molar masses are computed from ATOMIC_WEIGHTS below, never typed in.
 *   - Anything contested or unverified is marked FLAG and mirrored in SPEC.md.
 *   - Functions return raw numbers; rounding is the page's job.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Crema = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Shared atomic-weight table (g/mol). Same table across the sibling sites.
  // ---------------------------------------------------------------------
  var ATOMIC_WEIGHTS = Object.freeze({
    N: 14.007, O: 15.999, Na: 22.990, K: 39.098, Mg: 24.305,
    Ca: 40.078, S: 32.06, C: 12.011, H: 1.008, Cl: 35.45
  });

  // molarMass({Na:1, H:1, C:1, O:3}) -> sum of n_i * A_i
  function molarMass(composition) {
    var m = 0;
    for (var el in composition) {
      if (!(el in ATOMIC_WEIGHTS)) throw new Error('No atomic weight for ' + el);
      m += composition[el] * ATOMIC_WEIGHTS[el];
    }
    return m;
  }

  var H2O = molarMass({ H: 2, O: 1 });                           // 18.015
  var MOLAR = Object.freeze({
    H2O: H2O,
    Ca: ATOMIC_WEIGHTS.Ca,
    Mg: ATOMIC_WEIGHTS.Mg,
    Na: ATOMIC_WEIGHTS.Na,
    K: ATOMIC_WEIGHTS.K,
    HCO3: molarMass({ H: 1, C: 1, O: 3 }),                       // 61.016
    CO3: molarMass({ C: 1, O: 3 }),                              // 60.008
    SO4: molarMass({ S: 1, O: 4 }),                              // 96.056
    CaCO3: molarMass({ Ca: 1, C: 1, O: 3 }),                     // 100.086
    NaHCO3: molarMass({ Na: 1, H: 1, C: 1, O: 3 }),              // 84.006
    KHCO3: molarMass({ K: 1, H: 1, C: 1, O: 3 }),                // 100.114
    MgSO4_7H2O: molarMass({ Mg: 1, S: 1, O: 4 }) + 7 * H2O,      // 246.466
    CaSO4_2H2O: molarMass({ Ca: 1, S: 1, O: 4 }) + 2 * H2O       // 172.164
  });

  // "mg/L as CaCO3" is an equivalents unit: 1 meq/L = 50.043 mg/L as CaCO3,
  // because CaCO3 carries 2 equivalents per mole (Ca2+ / CO3 2-).
  var CACO3_EQ = MOLAR.CaCO3 / 2;                                // 50.043

  function req(name, v, opts) {
    opts = opts || {};
    if (typeof v !== 'number' || !isFinite(v)) throw new RangeError(name + ' must be a number');
    if (opts.positive && !(v > 0)) throw new RangeError(name + ' must be greater than 0');
    if (!opts.positive && v < 0) throw new RangeError(name + ' cannot be negative');
    if (opts.max !== undefined && v > opts.max) throw new RangeError(name + ' must be at most ' + opts.max);
    return v;
  }

  // =====================================================================
  // 1. WATER RECIPE
  // =====================================================================

  // SCA Water Standard, published in the SCAA Water Quality Handbook (2011)
  // and reproduced by SCA News, "Dissecting SCAA's Water Quality Standard"
  // (2013). FLAG: figures cross-checked against secondary reproductions of
  // the chart, not against the printed handbook — confirm before launch.
  // FLAG: the chart says "calcium hardness". Most recipe writers read it as
  // total hardness (Ca + Mg) because magnesium also counts toward extraction
  // and scale; this engine applies the range to total hardness and says so.
  var SCA_WATER = Object.freeze({
    source: 'SCAA Water Quality Handbook (2011), SCA Water Standard chart',
    tds: { target: 150, min: 75, max: 250, unit: 'mg/L' },
    hardness: { target: 68, min: 17, max: 85, unit: 'mg/L as CaCO3' },
    alkalinity: { target: 40, min: 40, max: 40, unit: 'mg/L as CaCO3', note: 'at or near 40' },
    sodium: { target: 10, unit: 'mg/L', note: 'at or near 10' },
    pH: { target: 7.0, min: 6.5, max: 7.5 }
  });

  // FLAG: approximate solubility of gypsum near room temperature (~2 g/L as
  // the dihydrate). Only used to warn; the SCA range needs well under 0.2 g/L.
  var GYPSUM_SOLUBILITY_G_PER_L = 2.0;
  // Typical kitchen-scale resolution; below this we recommend a stock solution.
  var SCALE_RESOLUTION_G = 0.1;

  /*
   * waterRecipe — minerals to add to distilled / RO water (assumed 0 ppm).
   *
   * Inputs (mg/L as CaCO3): alkalinity, hardness; mgShare = fraction of the
   * hardness supplied by magnesium (0..1); buffer 'NaHCO3' | 'KHCO3';
   * liters = batch size.
   *
   * Why TDS is an output, not an input: with three salts there are three
   * unknowns. Alkalinity pins the bicarbonate salt, hardness plus the Ca:Mg
   * split pins the two sulfates, so dissolved solids are fully determined.
   * A TDS target can only be checked against, not solved for (see SPEC.md).
   *
   * Derivation
   *   Alkalinity: each HCO3- is one equivalent of alkalinity (below pH ~8.3
   *   carbonate is negligible), so
   *     n_HCO3 [mmol/L] = alkalinity / 50.043
   *   Baking soda dissolves 1:1 into Na+ + HCO3-:
   *     NaHCO3 [g/L] = n_HCO3 * 84.006 / 1000
   *   Hardness: Ca2+ and Mg2+ are each two equivalents, and hardness as CaCO3
   *   counts 1 mmol of either as 100.086 mg, so
   *     n_hard [mmol/L] = hardness / 100.086
   *     n_Mg = mgShare * n_hard,  n_Ca = (1 - mgShare) * n_hard
   *   Epsom and gypsum dissolve 1:1 into metal + SO4 (hydrate water just
   *   joins the solvent):
   *     MgSO4.7H2O [g/L] = n_Mg * 246.466 / 1000
   *     CaSO4.2H2O [g/L] = n_Ca * 172.164 / 1000
   *   Ion concentrations [mg/L] = n [mmol/L] * ion molar mass.
   *
   * TDS is reported two ways (FLAG: "TDS" means different things to
   * different people):
   *   ionSum     — sum of every dissolved ion, mg/L. What you actually added
   *                minus hydrate water.
   *   evaporated — dried-residue convention (Standard Methods 2540C, 180 C):
   *                bicarbonate decomposes, 2 HCO3- -> CO3 2- + CO2 + H2O, so
   *                it counts at 60.008 / (2 * 61.016) = 0.4917 of its mass.
   *   Neither equals what a conductivity TDS pen shows; pens multiply
   *   conductivity by a fixed factor that assumes a reference salt.
   */
  function waterRecipe(input) {
    var alk = req('Alkalinity', input.alkalinity);
    var hard = req('Hardness', input.hardness);
    var mgShare = req('Magnesium share', input.mgShare, { max: 1 });
    var liters = req('Batch size', input.liters === undefined ? 1 : input.liters, { positive: true });
    var buffer = input.buffer || 'NaHCO3';
    if (buffer !== 'NaHCO3' && buffer !== 'KHCO3') throw new RangeError('Unknown buffer ' + buffer);

    var nHCO3 = alk / CACO3_EQ;              // mmol/L
    var nHard = hard / MOLAR.CaCO3;          // mmol/L
    var nMg = mgShare * nHard;
    var nCa = (1 - mgShare) * nHard;

    var perLiter = {
      buffer: nHCO3 * MOLAR[buffer] / 1000,
      epsom: nMg * MOLAR.MgSO4_7H2O / 1000,
      gypsum: nCa * MOLAR.CaSO4_2H2O / 1000
    };
    var batch = {
      buffer: perLiter.buffer * liters,
      epsom: perLiter.epsom * liters,
      gypsum: perLiter.gypsum * liters
    };

    var ions = {
      Ca: nCa * MOLAR.Ca,
      Mg: nMg * MOLAR.Mg,
      Na: buffer === 'NaHCO3' ? nHCO3 * MOLAR.Na : 0,
      K: buffer === 'KHCO3' ? nHCO3 * MOLAR.K : 0,
      HCO3: nHCO3 * MOLAR.HCO3,
      SO4: (nCa + nMg) * MOLAR.SO4
    };
    var ionSum = ions.Ca + ions.Mg + ions.Na + ions.K + ions.HCO3 + ions.SO4;
    var evaporated = ionSum - ions.HCO3 + ions.HCO3 * MOLAR.CO3 / (2 * MOLAR.HCO3);

    var warnings = [];
    ['buffer', 'epsom', 'gypsum'].forEach(function (k) {
      if (batch[k] > 0 && batch[k] < SCALE_RESOLUTION_G) warnings.push({ code: 'below-scale', salt: k });
    });
    if (perLiter.gypsum > GYPSUM_SOLUBILITY_G_PER_L) warnings.push({ code: 'gypsum-solubility' });
    if (ions.Na > SCA_WATER.sodium.target) warnings.push({ code: 'sodium-over-sca' });

    return {
      perLiter: perLiter,
      batch: batch,
      ions: ions,
      tds: { ionSum: ionSum, evaporated: evaporated },
      mmol: { HCO3: nHCO3, Ca: nCa, Mg: nMg },
      warnings: warnings
    };
  }

  // Inverse check used by the tests: ions (mg/L) -> hardness & alkalinity as CaCO3.
  //   hardness = (Ca/40.078 + Mg/24.305) * 100.086
  //   alkalinity = HCO3/61.016 * 50.043
  function waterFromIons(ions) {
    return {
      hardness: ((ions.Ca || 0) / MOLAR.Ca + (ions.Mg || 0) / MOLAR.Mg) * MOLAR.CaCO3,
      alkalinity: (ions.HCO3 || 0) / MOLAR.HCO3 * CACO3_EQ
    };
  }

  // =====================================================================
  // 2. EXTRACTION YIELD
  // =====================================================================

  // Brewing Control Chart window (Lockhart, Coffee Brewing Institute, 1950s;
  // carried into the SCA Golden Cup standard). FLAG: contested — see SPEC.md.
  var EY_WINDOW = Object.freeze({ min: 18, max: 22 });
  // SCA Golden Cup strength band for filter coffee, %TDS.
  // FLAG: regional charts differ (European and Nordic bands run higher).
  var STRENGTH_BAND = Object.freeze({ min: 1.15, max: 1.35 });

  /*
   * Percolation / espresso (beverage-weight method — the common convention).
   *   Dissolved solids in the cup   S  = TDS% / 100 * beverage
   *   Extraction yield             EY% = S / dose * 100 = TDS% * beverage / dose
   * Measures what reached the cup. Solids left in liquid held by the spent
   * bed are not counted, by definition.
   */
  function extractionPercolation(input) {
    var tds = req('TDS', input.tds, { positive: true, max: 100 });
    var dose = req('Dose', input.dose, { positive: true });
    var bev = req('Beverage weight', input.beverage, { positive: true });
    var solids = tds / 100 * bev;
    var ey = solids / dose * 100;
    return {
      method: 'percolation', ey: ey, solids: solids, ratio: bev / dose,
      window: classify(ey, EY_WINDOW), strength: classify(tds, STRENGTH_BAND),
      steps: [
        { label: 'Dissolved solids', expr: tds + '% × ' + bev + ' g', value: solids, unit: 'g' },
        { label: 'Extraction yield', expr: fmt(solids) + ' g ÷ ' + dose + ' g × 100', value: ey, unit: '%' }
      ]
    };
  }

  /*
   * Full immersion (brew-water method).
   * Assumption: at the end of the steep, liquid held in the grounds has the
   * same concentration as the liquid you pour off. Then all brew water W plus
   * the extracted solids S form one solution of concentration T (fraction):
   *     T = S / (W + S)   =>   S = T * W / (1 - T)
   *     EY = S / dose
   * FLAG: contested. Water absorbed inside the particles is not at the bulk
   * concentration, and a common shortcut drops the 1/(1 - T) term
   * (EY ≈ T * W / dose), reading about 1.3% (relative) lower at 1.3% TDS.
   * Both are shown on the page so nobody is silently overruled.
   */
  function extractionImmersion(input) {
    var tds = req('TDS', input.tds, { positive: true, max: 99 });
    var dose = req('Dose', input.dose, { positive: true });
    var water = req('Brew water', input.water, { positive: true });
    var t = tds / 100;
    var solids = t * water / (1 - t);
    var ey = solids / dose * 100;
    var shortcut = t * water / dose * 100;
    return {
      method: 'immersion', ey: ey, solids: solids, shortcutEy: shortcut, ratio: water / dose,
      window: classify(ey, EY_WINDOW), strength: classify(tds, STRENGTH_BAND),
      steps: [
        { label: 'Dissolved solids', expr: tds + '% × ' + water + ' g ÷ (1 − ' + (+t.toPrecision(12)) + ')', value: solids, unit: 'g' },
        { label: 'Extraction yield', expr: fmt(solids) + ' g ÷ ' + dose + ' g × 100', value: ey, unit: '%' },
        { label: 'Shortcut (no 1/(1−T) term)', expr: tds + '% × ' + water + ' g ÷ ' + dose + ' g', value: shortcut, unit: '%' }
      ]
    };
  }

  function classify(v, band) {
    return v < band.min ? 'below' : v > band.max ? 'above' : 'within';
  }

  function fmt(v) { return String(Math.round(v * 1000) / 1000); }

  // =====================================================================
  // 3. RATIO SCALER
  // =====================================================================

  // basis 'water': the ratio's second number is brew water (pourover habit).
  // basis 'beverage': it is liquid in the cup (espresso habit).
  var RATIO_PRESETS = Object.freeze([
    { id: 'po15', label: 'Pourover 1:15', ratio: 15, basis: 'water' },
    { id: 'po16', label: 'Pourover 1:16', ratio: 16, basis: 'water' },
    { id: 'po17', label: 'Pourover 1:17', ratio: 17, basis: 'water' },
    { id: 'esp2', label: 'Espresso 1:2', ratio: 2, basis: 'beverage' }
  ]);

  // FLAG: grams of liquid a spent filter bed holds per gram of dry coffee.
  // Published figures run about 1.8–2.2 g/g depending on grind and filter;
  // 2.0 is a house default and the page lets you change it.
  var DEFAULT_RETENTION = 2.0;

  /*
   * Ratio r in dose:out = 1:r.
   *   Forward:  out  = dose * r
   *   Reverse:  dose = out / r
   * Converting between bases (estimate only, uses retention R g/g):
   *   beverage ≈ water - R * dose,   water ≈ beverage + R * dose
   * Espresso is not converted: pucks hold far less and the out-weight is
   * measured directly.
   */
  function scaleRatio(input) {
    var r = req('Ratio', input.ratio, { positive: true });
    var basis = input.basis === 'beverage' ? 'beverage' : 'water';
    var R = req('Retention', input.retention === undefined ? DEFAULT_RETENTION : input.retention);
    var dose, out;
    if (input.dose !== undefined && input.dose !== null) {
      dose = req('Dose', input.dose, { positive: true });
      out = dose * r;
    } else {
      out = req('Output', input.output, { positive: true });
      dose = out / r;
    }
    var res = { dose: dose, output: out, ratio: r, basis: basis };
    if (basis === 'water') {
      res.water = out;
      res.beverageEstimate = Math.max(0, out - R * dose);
    } else {
      res.beverage = out;
    }
    return res;
  }

  // =====================================================================
  // 4. STRENGTH ADJUSTER
  // =====================================================================

  /*
   * Mass balance on dissolved solids. Current brew: mass m at TDS t1.
   * Add mass x of a liquid at TDS ta (0 for water, or a stronger coffee).
   *     m*t1 + x*ta = (m + x)*t2
   *  => x = m * (t1 - t2) / (t2 - ta)
   * Water (ta = 0): x = m * (t1/t2 - 1). Only possible if t2 < t1.
   * Coffee (ta > t2 > t1): same formula, both factors negative.
   * Target must lie strictly between ta and t1, otherwise no amount works.
   * TDS% is mass/mass, so masses are grams. Millilitres entered on the page
   * are treated as grams (FLAG: brewed coffee is ~0.5% denser at 1.3% TDS;
   * espresso more — use a scale for espresso).
   * The added water is taken as 0% TDS: refractometers are zeroed against
   * the brew water, so its minerals are already outside the reading.
   */
  function adjustStrength(input) {
    var m = req('Current amount', input.mass, { positive: true });
    var t1 = req('Current TDS', input.tds, { max: 100 });
    var t2 = req('Target TDS', input.target, { max: 100 });
    var ta = req('Added liquid TDS', input.addTds === undefined ? 0 : input.addTds, { max: 100 });
    var lo = Math.min(t1, ta), hi = Math.max(t1, ta);
    if (t2 === t1) return { add: 0, finalMass: m, finalTds: t1, addTds: ta };
    if (!(t2 > lo && t2 < hi)) {
      var err = new RangeError(ta === 0
        ? 'Water can only lower strength. To raise it, add stronger coffee.'
        : 'Target must fall between the current TDS and the added coffee\'s TDS.');
      err.code = 'unreachable';
      throw err;
    }
    var x = m * (t1 - t2) / (t2 - ta);
    return { add: x, finalMass: m + x, finalTds: (m * t1 + x * ta) / (m + x), addTds: ta };
  }

  // =====================================================================
  // 5. CAFFEINE ESTIMATOR
  // =====================================================================

  /*
   * mg caffeine ≈ dose[g] * 1000 * c * f
   *   c = caffeine mass fraction of the roasted coffee
   *   f = fraction of that caffeine that reaches the cup for the method
   * The low/high band multiplies the low ends together and the high ends
   * together, so it is the widest honest range, not a confidence interval.
   *
   * FLAG: all values below are house assumptions chosen to bracket the
   * published literature, not figures from a single source. Caffeine content
   * varies with cultivar, origin and roast; transfer varies with grind,
   * time and temperature. See SPEC.md for the reasoning.
   */
  var CAFFEINE_CONTENT = Object.freeze({
    arabica: { mid: 0.012, low: 0.009, high: 0.015 },
    robusta: { mid: 0.022, low: 0.017, high: 0.028 },
    // EU decaf limit: 0.1% of dry matter; typical product sits well under.
    decaf: { mid: 0.0005, low: 0.0002, high: 0.001 }
  });
  var CAFFEINE_TRANSFER = Object.freeze({
    pourover: { label: 'Pourover / drip', mid: 0.90, low: 0.80, high: 1.00 },
    immersion: { label: 'French press / immersion', mid: 0.90, low: 0.80, high: 1.00 },
    espresso: { label: 'Espresso', mid: 0.80, low: 0.65, high: 0.95 },
    moka: { label: 'Moka pot', mid: 0.85, low: 0.75, high: 0.95 },
    coldbrew: { label: 'Cold brew (12–24 h)', mid: 0.85, low: 0.70, high: 1.00 }
  });

  // robustaShare blends arabica and robusta content linearly by mass.
  function estimateCaffeine(input) {
    var dose = req('Dose', input.dose, { positive: true });
    var method = CAFFEINE_TRANSFER[input.method];
    if (!method) throw new RangeError('Unknown method ' + input.method);
    var c;
    if (input.species === 'decaf') c = CAFFEINE_CONTENT.decaf;
    else {
      var s = req('Robusta share', input.robustaShare === undefined ? 0 : input.robustaShare, { max: 1 });
      var a = CAFFEINE_CONTENT.arabica, r = CAFFEINE_CONTENT.robusta;
      c = {
        mid: a.mid * (1 - s) + r.mid * s,
        low: a.low * (1 - s) + r.low * s,
        high: a.high * (1 - s) + r.high * s
      };
    }
    return {
      mg: dose * 1000 * c.mid * method.mid,
      low: dose * 1000 * c.low * method.low,
      high: dose * 1000 * c.high * method.high,
      content: c, transfer: method
    };
  }

  return {
    ATOMIC_WEIGHTS: ATOMIC_WEIGHTS, MOLAR: MOLAR, CACO3_EQ: CACO3_EQ, molarMass: molarMass,
    SCA_WATER: SCA_WATER, GYPSUM_SOLUBILITY_G_PER_L: GYPSUM_SOLUBILITY_G_PER_L,
    SCALE_RESOLUTION_G: SCALE_RESOLUTION_G,
    waterRecipe: waterRecipe, waterFromIons: waterFromIons,
    EY_WINDOW: EY_WINDOW, STRENGTH_BAND: STRENGTH_BAND,
    extractionPercolation: extractionPercolation, extractionImmersion: extractionImmersion,
    RATIO_PRESETS: RATIO_PRESETS, DEFAULT_RETENTION: DEFAULT_RETENTION, scaleRatio: scaleRatio,
    adjustStrength: adjustStrength,
    CAFFEINE_CONTENT: CAFFEINE_CONTENT, CAFFEINE_TRANSFER: CAFFEINE_TRANSFER,
    estimateCaffeine: estimateCaffeine
  };
});
