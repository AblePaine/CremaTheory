# CremaTheory — Engine Specification

CremaTheory (crematheory.com) is the specialty-coffee site in the family with DoughMatrix, MicroRadicle, Saponis, FinsFlora and SalumiLab. Here "brew" always means **coffee** brewing. Beer vocabulary (wort, gravity, attenuation) stays out of this repo.

**House principle:** zero guesswork. You enter what you know and get an exact answer. Where the science is contested, we footnote it and don't pick a side silently. Where a figure couldn't be checked against its primary source, it is marked **FLAG** in this file and in the code.

## Layout

```
index.html            landing page
water.html            1. water recipe
extraction.html       2. extraction yield
ratio.html            3. ratio scaler
strength.html         4. strength adjuster
caffeine.html         5. caffeine estimator
assets/crema.js       shared formula module (browser global `Crema`, node `require`)
assets/crema.css      shared styles, mobile-first, light/dark
tests/*.test.js       node:test suite — `npm test` (Node ≥ 18, no dependencies)
SPEC.md               this file
```

Static HTML/CSS/JS with no framework and no build step. Each page is a standalone document that loads only `assets/crema.css` and `assets/crema.js`. All maths lives in `crema.js`. The pages only read inputs, call it, and format the results. The tests `require` the same file the pages load.

## Shared constants

### Atomic weights (g/mol) — shared family table

| N | O | Na | K | Mg | Ca | S | C | H | Cl |
|---|---|----|---|----|----|---|---|---|----|
| 14.007 | 15.999 | 22.990 | 39.098 | 24.305 | 40.078 | 32.06 | 12.011 | 1.008 | 35.45 |

### Derived molar masses (computed in code from the table, never typed in)

| Species | Sum | g/mol |
|---|---|---|
| H₂O | 2(1.008) + 15.999 | 18.015 |
| HCO₃⁻ | 1.008 + 12.011 + 3(15.999) | 61.016 |
| CO₃²⁻ | 12.011 + 3(15.999) | 60.008 |
| SO₄²⁻ | 32.06 + 4(15.999) | 96.056 |
| CaCO₃ | 40.078 + 12.011 + 3(15.999) | 100.086 |
| NaHCO₃ (baking soda) | 22.990 + 61.016 | 84.006 |
| KHCO₃ | 39.098 + 61.016 | 100.114 |
| MgSO₄·7H₂O (Epsom) | 24.305 + 96.056 + 7(18.015) | 246.466 |
| CaSO₄·2H₂O (gypsum) | 40.078 + 96.056 + 2(18.015) | 172.164 |

"mg/L as CaCO₃" is an equivalents unit. 1 meq/L = CaCO₃/2 = **50.043 mg/L as CaCO₃**.

---

## 1. Water recipe

**Inputs:** alkalinity A and hardness H (mg/L as CaCO₃), Mg share s (0–1) of the hardness, buffer salt (NaHCO₃ default, KHCO₃ optional), batch volume V (L), and an optional TDS target (checked against, not solved for).

**Assumptions:** the starting water is distilled or RO at 0 ppm. Each salt dissolves 1:1 into its ions, and hydrate water joins the solvent. At brewing pH (below ~8.3) all alkalinity is bicarbonate.

**Formulas**

```
n_HCO3 = A / 50.043                     mmol/L   (1 HCO3- = 1 meq)
buffer = n_HCO3 × M_buffer / 1000       g/L
n_hard = H / 100.086                    mmol/L   (1 mmol Ca2+ or Mg2+ = 100.086 mg as CaCO3)
n_Mg   = s × n_hard ;  n_Ca = (1 − s) × n_hard
epsom  = n_Mg × 246.466 / 1000          g/L
gypsum = n_Ca × 172.164 / 1000          g/L
batch grams = g/L × V
ion mg/L    = n × ion molar mass;  SO4 = (n_Ca + n_Mg) × 96.056
```

**TDS is an output.** There are three salts and three unknowns. Alkalinity fixes the bicarbonate salt, and hardness plus the Ca:Mg split fix the two sulfates, so dissolved solids follow from those choices. The brief asked for a target-TDS input. Meeting it would mean quietly adjusting one of the other targets, so the page instead reports the result next to the user's target and the SCA range. *Decision for reviewer:* if a "TDS-first" mode is wanted (fix the ratios, scale everything to hit TDS), it is a small addition.

TDS is reported two ways, because "TDS" means different things:
- **Ion sum.** Every dissolved ion in mg/L. This equals the salts added minus their hydrate water (tested).
- **Evaporated residue** (Standard Methods 2540C, 180 °C). Bicarbonate breaks down (2 HCO₃⁻ → CO₃²⁻ + CO₂ + H₂O), so it counts at 60.008 / 122.032 = 0.4917 of its mass.
- A conductivity TDS pen will match neither exactly, because it multiplies conductivity by a fixed factor based on a reference salt. This is stated on the page, and no pen reading is estimated.

**Worked check (SCA target, 50/50, baking soda, 1 L):** NaHCO₃ 0.0671 g, Epsom 0.0837 g, gypsum 0.0585 g gives Ca 13.6, Mg 8.3, Na 18.4, HCO₃ 48.8, SO₄ 65.3 mg/L. Ion sum is 154.3 mg/L, which lands close to the SCA's 150 target without any tuning.

**Warnings shown:** any weighing under 0.1 g (you need a 0.001 g scale or a larger batch), sodium above 10 mg/L, and gypsum above ~2 g/L.

**Sources and flags**
- **SCA Water Standard.** SCAA *Water Quality Handbook* (2011), Water Standard chart: TDS 150 mg/L (75–250), calcium hardness 68 mg/L as CaCO₃ (17–85), total alkalinity at or near 40 mg/L, sodium at or near 10 mg/L, pH 7.0 (6.5–7.5). SCA News, "Dissecting SCAA's Water Quality Standard" (2013), reproduces the same chart. **FLAG:** these figures were checked against secondary reproductions, not the printed handbook. Check against the print copy before launch.
- **FLAG (contested):** the chart says *calcium* hardness. We apply the range to *total* hardness (Ca + Mg), as most recipe writers do. The page says this.
- **FLAG (contested):** the standard does not specify a Ca:Mg split. The page defaults to 50% and footnotes the arguments on both sides (Mg for extraction, Ca for scale risk).
- **FLAG (conflict inside the standard):** reaching 40 mg/L alkalinity with baking soda adds ~18 mg/L Na, above the "at or near 10" sodium target. KHCO₃ is offered as the alternative. Whether this much sodium is noticeable in the cup is disputed.
- **FLAG:** gypsum solubility of ~2 g/L is approximate and only used for a warning.

## 2. Extraction yield

**Percolation / espresso (beverage-weight method).** This is the common convention.
```
solids = TDS% / 100 × beverage_g
EY%    = solids / dose_g × 100   =  TDS% × beverage / dose
```
It counts what reached the cup. Liquid held back in the spent bed is not counted, by convention.

**Full immersion (brew-water method).** Assumption: the liquid held in the grounds is the same strength as the liquid you pour off, so all water W plus the solids S form one solution at concentration T:
```
T = S / (W + S)   ⇒   S = T·W / (1 − T)
EY = S / dose
```
The page also shows the common shortcut EY ≈ T·W/dose, which reads lower by a factor of (1 − T). **FLAG (contested):** water absorbed *inside* particles may not be at the bulk concentration, and methods that use a liquid-retained ratio (LRR) model this differently. Both results are displayed so nobody's method is silently overruled.

**Reference bands**
- 18–22% EY: Brewing Control Chart (Lockhart, Coffee Brewing Institute, 1950s), carried into the SCA Golden Cup standard. **FLAG (contested):** it came from mid-century filter-coffee taste panels. Frost, Ristenpart & Guinard, *J. Food Sci.* (2020) found that preferred cups spread across the chart, depending on the taster and the roast. It was never tested for espresso.
- 1.15–1.35% TDS: SCA Golden Cup strength. **FLAG:** European and Nordic bands run higher.

**Also footnoted:** moisture in the dry dose is ignored, as in almost all published EY figures, and the refractometer sample-prep debate (temperature, filtering espresso) is noted.

The page shows every step with the user's own numbers substituted in.

## 3. Ratio scaler

Ratio 1:r (coffee:output).
```
forward: output = dose × r
reverse: dose   = output / r
```
Each ratio has a **basis**. Pourover presets (1:15, 1:16, 1:17) are by *brew water*. The espresso preset (1:2) is by *beverage out*. Custom ratios let the user choose. For a water-basis ratio the page also estimates what ends up in the cup:
```
beverage ≈ water − R × dose        (clamped at 0)
```
R is the liquid the grounds hold back, in g per g of dry coffee. The house default is 2.0. **FLAG:** reported figures run ~1.8–2.2 depending on grind and filter, so R can be edited and the result is labelled an estimate. Espresso is not converted, because the shot is weighed directly.

## 4. Strength adjuster

Mass balance on dissolved solids. Current brew is m g at t₁%. Add x g of a liquid at tₐ% (0 = water):
```
m·t₁ + x·tₐ = (m + x)·t₂   ⇒   x = m (t₁ − t₂) / (t₂ − tₐ)
```
- Water: x = m (t₁/t₂ − 1). Only works when t₂ < t₁.
- Stronger coffee (tₐ > t₂ > t₁): same formula.
- A target outside (tₐ, t₁) is unreachable, and the page gives an error explaining why. It doesn't return a negative number.
- TDS% is mass/mass. mL is treated as g. **FLAG:** filter coffee is ~0.5% denser than water and espresso more, so the page says to weigh espresso.
- Added water counts as 0% TDS because the refractometer is zeroed on the brew water.

## 5. Caffeine estimator

```
mg      = dose_g × 1000 × c × f
low/high = dose × c_low × f_low  /  dose × c_high × f_high
```
- c is the caffeine mass fraction of the roasted coffee. f is the share that reaches the cup.
- Blends are linear in robusta share: c = (1 − s)·c_arabica + s·c_robusta.
- The range is the widest spread these assumptions allow. It is not a confidence interval.

| Coffee | c mid | c range |
|---|---|---|
| Arabica | 1.2% | 0.9–1.5% |
| Robusta | 2.2% | 1.7–2.8% |
| Decaf | 0.05% | 0.02–0.10% (EU limit 0.1% of dry matter) |

| Method | f mid | f range |
|---|---|---|
| Pourover / drip | 0.90 | 0.80–1.00 |
| French press / immersion | 0.90 | 0.80–1.00 |
| Moka | 0.85 | 0.75–0.95 |
| Espresso | 0.80 | 0.65–0.95 |
| Cold brew (12–24 h) | 0.85 | 0.70–1.00 |

**FLAG:** every c and f value is a house assumption set to cover the published literature. None comes from a single source. They should be reviewed against primary studies (e.g. caffeine-extraction kinetics and cold-brew comparisons) before launch. The page labels the result an estimate everywhere and advises using lab figures where caffeine matters for health.

## Tests

`npm test` runs `node --test tests/*.test.js`:
- `chemistry`: the atomic table matches the family table exactly, and every molar mass matches a hand sum.
- `water`: hand-worked SCA example, round trip (ions → hardness/alkalinity), charge balance (cation meq = anion meq), mass balance (ion sum = salts − hydrate water), evaporation factor, KHCO₃ swap, batch scaling and warnings, validation.
- `extraction`: hand-worked filter and espresso cases, immersion formula and shortcut ratio, self-consistency (S/(W+S) = T), window edges, validation.
- `ratio`: forward, reverse, round trip, basis handling, retention clamp, presets.
- `strength`: dilution, strengthening with espresso, mass-balance sweep, unreachable targets.
- `caffeine`: hand-worked case, linear blend, low ≤ mid ≤ high for every method, validation.

## Open items for the reviewer

1. Check the SCA chart values against the printed *Water Quality Handbook*.
2. Decide whether to add a "TDS-first" water mode (see §1).
3. Replace the caffeine c/f assumptions with values from cited primary studies.
4. Confirm the default Ca:Mg split (50%) and retention factor (2.0 g/g).
