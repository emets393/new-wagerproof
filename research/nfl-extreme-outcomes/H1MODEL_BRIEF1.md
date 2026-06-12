# H1MODEL BRIEF #1 — 1st-Half Models (totals / spread / ML) + Signal Confluence

**Goal (product framing):** per-game 1H predictions for every game — same architecture
as the FG product: model = the per-game number, K-signals (H1TT_BRIEF1.md) = the
high-confidence overlay. 855 games 2023-25, all bets/grades at 1H consensus CLOSE
(median line + median payout) with close-time features — signal/bet/grade aligned.
Scripts: `h1m_models.py` (unanchored v1 + frame), `h1m_models2.py` (anchored v2),
`h1m_robust.py`, `h1m_confluence.py`, `h1m_walkforward.py` (the honest audit).
OOS preds: `data/h1m_preds.parquet`.

> **READ THE WALK-FORWARD AUDIT SECTION FIRST.** The LOSO numbers below (sections
> written first) train on future seasons for 2023/2024 rows and use full-season
> K1 ranks. The TRUE walk-forward numbers are ~half the LOSO ROI and are the only
> ones to quote. LOSO sections kept for reference on structure/drivers.

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

---

# WALK-FORWARD AUDIT (h1m_walkforward.py) — THE NUMBERS TO QUOTE

User challenge (correct): LOSO is NOT walk-forward — 2023/2024 predictions came
from models trained partly on FUTURE seasons, and K1 used full-season residual
ranks (look-ahead). Fixed: 2024 preds = model trained on 2023 only; 2025 preds =
trained on 2023-24; K1 re-ranked point-in-time within each WEEK's slate. 2023
has no prior season → dropped (570 graded rows). 95% Wilson CIs added.

| Flag | LOSO claim | TRUE walk-forward | CI95 (win%) |
|---|---|---|---|
| Totals window 1.5-2.5 | 59.7% / +13.8% | **54.7% / +4.4%** (2024 −6, 2025 +15) | — |
| Totals window 1.25-2.75 | 56.8% / +8.3% | 54.0% / +3.1% (2024 −13, 2025 +19) | 47-61% |
| M1 window-over + K1 | 67.9% / +29.7% | **63.9% / +22.6%** (n=37) | **48-78%** |
| M2 K1 + model lean (FG over) | 63.1% / +20.0% | **59.3% / +12.9%** (+12/+14) | 49-69% |
| M2 "model drops K1 losers" | drops = −10.7% | drops = **+6.5%** (claim DEAD) | — |
| M3 K8 + model agrees | 65.2% / +23.5% | **59.1% / +13.3%** (+5/+20) | 44-72% |
| M3 K8 + model disagrees | −7.9% | −2.4% (direction holds, weakly) | — |

**Honest conclusions:**
1. **The 2024 model (one training season) was weak** (window −6 to −14%); the 2025
   model (two training seasons) hit +15-34% across flags. We have exactly ONE
   honest test season with an adequately trained model. Structure is encouraging;
   evidence is thin.
2. **Every confluence filter still points the right way** (agree > all > disagree)
   in walk-forward — but magnitudes halve and every CI includes or nears break-even.
3. The "model rescues K1" claim does NOT survive: with point-in-time K1 the model
   filter adds ~+2pp, it doesn't flip the drops negative.
4. Verdict (superseded): originally judged tracking-tier. **User decision
   2026-06-11: VAULTED — production 1H model + M1-M4 flags (LOCKED_MODELS.md §8).**
   The caveats above still apply: one honest test season; ledger every 2026 pick;
   retrain on 2023-25 in the offseason.

# MODEL CARD (h1m_model_card.py) — raw walk-forward, NO signals — ADOPTED

**Decision (user, 2026-06-11): this is the production 1H model.** Product framing
(see wagerproof-nfl-model-purpose): every game gets a number; tiers below.

570 games (2024 from 2023-train; 2025 from 23-24-train), bets/grades at close:

| Market | Full slate | Best band | 2024 | 2025 |
|---|---|---|---|---|
| TOTAL | 53.1% / +1.3% | mod band 0.5-3.0: 54.3% / +3.7% (n=359) | 50% / −5% | 58% / +12% |
| TOTAL HC | — | window 1.25-2.75: 54.0% / +3.1% (n=217) | 46% / −13% | 62% / +19% |
| SPREAD | 51.6% / −0.9% | ≥2.0: 54.0% / +3.8% (n=241) | 57% / +10% | 50% / −3% |
| ML | brier 0.2317 (mkt 0.2302) | winner acc 61-63%; betting = −EV | — | — |

**Production tiers:**
1. Display (every game): 1H total, 1H spread, 1H win prob.
2. Lean: totals moderate band (0.5 ≤ |edge| < 3.0) → "model lean" label (~6-7/wk).
3. HC: window picks + confluence M1 (window-over + K1 → 1H over) and M3
   (K8 primetime fav + spread-tilt agree). Spread model NEVER bets alone — filter only.
4. Cap: |edge| ≥ 3.0 → show number, suppress confidence (falloff confirmed both seasons).

Known weakness to track: totals-2024 and spread-2025 were each negative — the two
markets haven't had a simultaneous good honest season. 2026 (3 training seasons)
is the confirmation year; ledger it like tracking-tier flags until then.

# 2025 COMBINED LEDGER (h1m_2025_combined.py) — model bands x point-in-time signals

Train 23-24, test 2025, weekly-slate K1, all at close. The HC-tier portfolio:

| Flag | Bets | Record | Win% | ROI | Units |
|---|---|---|---|---|---|
| M1 window-over + K1 → 1H OVER | 23 | 16-7 | 69.6% | +34.1% | +7.8 |
| M2 K1 + model lean → FG OVER | 47 | 28-19 | 59.6% | +13.7% | +6.4 |
| M3 SNF/MNF fav + tilt agree → fav 1H | 25 | 15-9-1 | 62.5% | +19.7% | +4.9 |
| M4 slow-start dog fade + tilt agree | 30 | 17-13 | 56.7% | +8.8% | +2.6 |
| **PORTFOLIO** | **125** | **76-48-1** | **61.3%** | **+17.5%** | **+21.8** |

93 distinct games, 22 weeks (~5.7 bets/wk), 25 games with 2+ flags. M1/M2/M3
match the walk-forward audit's 2025 columns; M4 is new (thinnest edge, 0-3 wk16).
**VAULTED 2026-06-11 (user decision) → LOCKED_MODELS.md §8.** One honest season —
ledger every 2026 pick as the confirmation test.

## Caveats
- Same thin-market caveats as H1TT_BRIEF1 (9-12 books, ~−115, lower limits).
- Peak windows/cutoffs chosen after seeing LOSO results — the conservative claims
  are the broad bands (≥1.25 totals window; K1×model filter; K8×agree).
- n=37-94 on walk-forward confluence flags: spot-sized, wide CIs.
- Retrain residual GBM each offseason; 2026 live = the third honest test.
