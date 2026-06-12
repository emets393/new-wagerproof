# H1MODEL BRIEF #1 — 1st-Half Models (totals / spread / ML) + Signal Confluence

**Goal (product framing):** per-game 1H predictions for every game — same architecture
as the FG product: model = the per-game number, K-signals (H1TT_BRIEF1.md) = the
high-confidence overlay. 855 games 2023-25, all bets/grades at 1H consensus CLOSE
(median line + median payout) with close-time features — signal/bet/grade aligned.
Validation: leave-one-season-out (every prediction OOS). Scripts: `h1m_models.py`
(unanchored v1 + frame), `h1m_models2.py` (anchored v2, the keeper),
`h1m_robust.py`, `h1m_confluence.py`. OOS preds: `data/h1m_preds.parquet`.

## Architecture lesson (v1 → v2)

Unanchored models LOSE to the market (model MAE 7.03 vs market 6.82 on 1H totals;
ML brier 0.263 vs market 0.230). 1H lines are priced off FG lines (H1TT dead end #1),
so v2 anchors on the market: **prediction = 1H close line + GBM-predicted residual**,
residual fit on context + cross-market gaps only (no raw line levels). Shallow
HistGradientBoosting (depth 2, min_leaf 60, strong L2); handles missing early-season
context natively → every game gets a number, weeks 1-3 included.

## 1H TOTAL model — the real edge

GBM residual corr with actual residual is only 0.094, but that's enough:

| |edge| band | n | win | ROI | per-season |
|---|---|---|---|---|
| 1.25-2.75 (broad) | 305 | 56.8% | +8.3% | +3 / +2 / +19 |
| **1.5-2.5 (peak)** | 202 | **59.7%** | **+13.8%** | **+16 / +11 / +15** |
| ≥1.25 (everything) | 460 | 55.7% | +6.1% | +4 / +7 / +7 |

- Window is not knife-edge: all neighboring bands positive; ≥1.25 positive all
  3 seasons. Peak band selected post-hoc — treat 1.5-2.5 as the HC tier and
  ≥1.25 as the honest baseline claim (same shape as FG consensus model's 3-7 window).
- Mostly OVER picks (161/202 in peak band; overs +13.2% every season; unders thin n=41).
- Too-big edges (≥2.5-3) fall off — model is missing info the market has. Same
  pattern as FG: cap the edge.
- Drivers (permutation, fit 23-24 → 25): away L3 points-allowed, primetime, wind,
  away rest, away season ppg, tt-sum gap. Context, not a K1 rebuild (K1 overlap 24%).

## 1H SPREAD model — display + confluence filter only

Residual corr ≈ 0 (-0.03). No edge bucket survives (+/− noise, big edges −8 to −11%).
**But the tilt direction is a real filter for the 1H spread keepers:**

| Keeper | All bets | Model AGREES | Model DISAGREES |
|---|---|---|---|
| K8 primetime 1H fav | 57.6% / +10.0% (121) | **65.2% / +23.5% (69, +27/+20/+25)** | 48.1% / −7.9% (52) |
| K7 slow-start dog fade | 58.3% / +11.2% (155) | 59.6% / +13.8% (97, all + ) | 56.1% / +6.9% (58) |
| K3 steam follow | — | no split value (skip) | — |

Exactly the FG sides architecture: model alone = product number (~50-51% vs close),
model+spot alignment = the bet.

## 1H ML model — product display layer

Logistic calibration of the 1H close spread (LOSO) matches/edges the de-vigged
market: brier 0.2288 vs market 0.2295. Adding the spread-model tilt changes nothing.
EV-threshold betting vs median prices: negative at all thresholds → **no ML betting
edge; use the calibrated probs as the every-game win-probability display.**
Straight 1H-winner picks: just show the favorite (64% accuracy baseline).

## CONFLUENCE KEEPERS (the new bet flags)

### M1. 1H total model window + K1 → 1H OVER  `h1_model_k1_over`
Model residual in +1.25..+2.75 (1H over lean) AND K1 tt-sum top-quintile fired
→ bet 1H total OVER at close.
- **67.9% / +29.7% (n=53, ~0.6/wk)** — 2023 +32% | 2024 +14% | 2025 +34%
- Model window over alone: 58.1%/+10.8% (n=231). K1-quiet remainder +5.2%.

### M2. K1 filtered by the 1H model → FG OVER upgrade  `k1_model_filter`
K1 fires AND 1H model residual > +0.5 → bet the FG OVER (K1's own bet).
- **63.1% / +20.0% (n=125)** — +16 / +32 / +17, every season.
- K1 with model flat/under: 46.6% / −10.7% → **the model turns K1 from +11% to
  +20% by dropping the bottom 40%.** This upgrades a LOCKED-family signal.

### M3. K8 + model agreement → 1H fav  `primetime_fav_model`
SNF/MNF favorite AND spread-model tilt on the fav → 1H spread on the favorite.
- **65.2% / +23.5% (n=69, ~0.7/wk)** — +27 / +20 / +25, every season.
- Model-disagree K8 bets are dead (−7.9%) → always check the tilt.

### Portfolio
Model-window 1H over OR (K1 + model lean) = 57.9%/+10.3% (n=303, ~3.5/wk),
2023 +2 / 2024 +13 / 2025 +17.

## Caveats
- Same thin-market caveats as H1TT_BRIEF1 (9-12 books, ~−115, lower limits).
- Peak windows/cutoffs chosen after seeing LOSO results — the conservative claims
  are the broad bands (≥1.25 totals window; K1×model filter; K8×agree).
- n=53-125 on the confluence flags: spot-sized. Track live before sizing up.
- Retrain residual GBM each offseason (LOSO here ≈ "fit two seasons, predict one").
