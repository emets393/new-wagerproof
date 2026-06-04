# CFB LOCKED MODELS & SPOTS — canonical reference

The single source of truth for the College Football product. Everything here is **walk-forward**
(trained only on seasons < target; no game trains on its own season) and graded on the **honest
rule: signal-line == grade-line** (a spot bet at the close is graded at the close, at DraftKings is
graded at DK, etc.). Everything is wired into `cfb_forecast.py` and runs each week.

```
python3 cfb_forecast.py                       # 2025 dry-run (train <2025), prints per-spot grades
python3 cfb_forecast.py --season 2026 --week 6  # weekly production (needs 2026 data + odds pulled)
```
Outputs: `out/cfb_predictions_<season>.csv` (every game — website display) and
`out/cfb_bets_<season>.csv` (games where ≥1 spot fires — the bet ledger).

---

## 1. BASE MODELS (the website product — a number for every game)

Two `HistGradientBoostingRegressor`s (max_iter=300, lr=0.05, depth=4, l2=1.0), fundamentals-only
(opponent-adjusted EPA/SR/explosiveness/line-yards/havoc/PPO/pace/returning-prod/talent/ELO-as-of-wk1;
**priors excluded** — they help prediction but hurt betting). Source table `data/model_games.parquet`
(6652 games, 2016-19 + 2021-25; 2020 COVID-absent).

- **Totals model** → `pred_total`; `total_edge = pred_total − total_open`.
- **Sides model** → `pred_margin` (home perspective); `side_edge = pred_margin + spread_open`,
  `side_edge_close = pred_margin + spread_close`. `pred_spread = −pred_margin`.

**Honest baseline:** the sides model graded at the **close** is ~50.8% (−3% ROI) — i.e. it is a
**+CLV product, not a standalone close-beater** (2025 model CLV +0.38 pts). It becomes *bettable*
only when a line signal confirms it (see §2 STACK). This is by design — see memory
`wagerproof-nfl-model-purpose`: the per-game number is the product; spots are the bet layer.

---

## 2. SPOT LIBRARY (the bet layer) — `spot_library()` in cfb_forecast.py

Each spot = `(mask, side, market, grade_line)`. Stats are multi-year walk-forward unless noted;
`[per-season]` shown where it drove the decision. **2025 = pure holdout.**

### 2a. HEADLINE — MODEL × SOFT-BOOK STACK (two INDEPENDENT edges agree) · grade @ close
The fundamentals model and the market-microstructure soft-book gap are independent; when they agree
they stack. Built in `combo_model_lines.py`. Vetoed when a late reversal contradicts the model.
| Spot | Rule | Hit | n | Note |
|---|---|---|---|---|
| STACK model+gap≥1 | model lean (|edge_close|≥2) == sign(soft_gap), |gap|≥1 | **72.7%** | 55 | 2025: 77.8% (n9) |
| STACK model+gap.5-1 | same, 0.5≤|gap|<1 | **~55%** | 311 | volume |
> When model & soft-book **disagree**, the model side is sub-50 → **PASS** (don't bet).

### 2b. SOFT-BOOK STANDALONE (line discrepancy) · grade @ best soft number
`book_consensus_blend.py`. SHARP = median{williamhill_us, twinspires, draftkings};
SOFT = median{bovada, mybookieag}; `soft_gap = sharp_close − soft_close`. Bet the SHARP side at the
best soft number.
| Spot | Rule | Hit | ROI | n/yr |
|---|---|---|---|---|
| SB premium gap≥1 | |gap|≥1, bet sharp side | **64.2%** | +22.6% | ~22 |
| SB volume gap.5-1 | 0.5≤|gap|<1 | **56.8%** | +8.4% | ~150 |
> Sharpest books: William Hill, TwinSpires. Softest: **MyBookie** (lean covers 45.6%), Bovada (48.2%).
> FanDuel/DK/BetMGM deviate a lot but are **directionally random** (not fadeable). Edge is **spread-only**
> (totals & ML soft-book = dead/artifact). Timing: gap≥1 can be bet **24h early** (~65% + ~+1.75 CLV);
> gap≥0.5 must wait for close. Needs accounts at a sharp ref + soft book(s); Bovada is the reliable anchor.

### 2c. KEY NUMBERS (DraftKings close) · grade @ dk
`dk_keynumbers.py`. CFB margins cluster at 3 (10.6%) and 7 (8.8%); totals are smooth (no total key #s).
| Spot | Rule | Hit | n | Mechanism |
|---|---|---|---|---|
| KEY dog +2.5/3/3.5 | take small dog | 54.1% | 628 | fade small chalk; 3 = top margin |
| KEY lay −6.5 | back fav at −6.5 | 57.3% | 143 | wins on the 7-point margin |
> Rejected as noise: the −8.5/−9.5 "fav covers" flicker (adjacent numbers alternate).

### 2d. CONFERENCE structural numbers · grade @ close
`conf_numbers.py`. Specific numbers mean different things by conference (style/pace/defense). These are
*structural*, not microstructure — which reconciles the "totals movement is dead" finding. Survivors
passed per-season + recent-year (2021-25) validation + mechanism (out of ~190 cells tested).
| Spot | Rule | Hit (21-25) | n | Mechanism |
|---|---|---|---|---|
| CONF SunBelt fade home-fav | Sun Belt, home favored → take dog (AWAY) | 57.7% | 156 | home favs overvalued |
| CONF SEC total 52+ UNDER | SEC, total>52 → under | 56.7% | 141 | defensive league |
| CONF AAC total 52-59 OVER | American, 52<tot≤59 → over | 56.7% | 104 | up-tempo pass-happy G5 |
| CONF BigTen away-fav cover | Big Ten, away favored → AWAY | 55.2% | 145 | road favs undervalued |
| CONF SunBelt total 59-66 UNDER | Sun Belt, 59<tot≤66 → under | 67.9% | 56 | run-heavy (thin n) |
> Caveat: multiple-comparisons risk; thin ones (SunBelt 59-66 n56, BigTen≥14.5 n37) are higher variance.

### 2e. TOTALS — fundamentals model spots · grade @ open
| Spot | Rule | Mechanism |
|---|---|---|
| T1 under: model+high-total/weakD | total_edge≤−3 & (open≥62 or both-weak-passD) & non-mix | model + structure |
| T1 over: low-total+fast (P5) | open≤48 & pace≥p66 & P5 | underpriced pace |
| T2 over: week 13 | rivalry/championship week | |
| T2 under: week 1 opener | openers play under | |
| T2 under: ranked-upset-last-wk / PT-rr-letdown / backup-QB(open≥50) | situational | |

### 2f. SIDES — fundamentals model spots · grade @ open
| Spot | Rule | Close hit |
|---|---|---|
| PREMIUM lay-fav home/away | |side_edge|≥8, P5, |open|<21, back the favorite | 68.6/62.5% |
| T2 high-edge dog home/away | |side_edge|≥8, P5, take the dog | 60/58% |
| T3 away: P5 edge −4to−8 | moderate away edge (public home bias) | |
| T3 fade home backup QB | home on backup QB → bet away | |

---

## 3. REVERSAL VETO
A late spread reversal (open→24h and 24h→close move in opposite directions, each ≥1 pt) that
**contradicts** the model drops the model to 40% (`combo_model_lines.py`). The harness sets
`rev_veto=1` and suppresses the STACK spots in that case. Reversal is a **danger flag, not a confirm**.

---

## 4. NEGATIVE-RESULT ARCHIVE (tested & rejected — do not revisit without new data)
- **Moneyline**: market is well-calibrated; no edge. Earlier "huge ROI" were corrupted/stale ML data
  artifacts (−100000 placeholders, big-dog variance). `moneyline_value.py`, `phase2_ml_divergence.py`.
- **Totals line movement / juice / steam**: dead. `phase1d_totals_movement.py`, `phase1c_juice.py`.
- **Totals soft-book gap & key numbers**: dead/smooth. `book_disagreement_totals_ml.py`, `dk_keynumbers.py`.
- **Generic full line-move direction as model confirm**: no info (50.1 vs 47.9). `combo_model_lines.py`.
- **Public betting splits**: unavailable / un-backfillable — dropped.
- **Soft-book general lag (snipe everything early)**: rejected — soft chases sharp only 49% (coin flip);
  only gap≥1 is early-bettable. `book_lag_analysis.py`.
- Many conference×number cells: noise (efficient). Only the §2d survivors held up.

---

## 5. DATA DEPENDENCIES & PRODUCTION NOTES
- Base models + situational + conference spots: need only `data/model_games.parquet` + `data/cfbd/*`.
- Market-microstructure spots (STACK, SB, KEY) + reversal veto: need the **odds archive**
  (`data/odds_history/odds_<year>.parquet`, via `fetch_odds_history.py`; also mirrored in Supabase
  `ncaaf_odds_history`). Computed by `line_signals.py`. **For 2026 production these require pulling
  current per-book odds** (William Hill + DraftKings + TwinSpires sharp; Bovada + MyBookie soft).
  If the archive is absent for a season, those columns are NaN and the spots simply don't fire.
- Secrets live in `.env.local` (gitignored) — CFBD + Odds API keys. **Never** put keys in `.env`
  (git-tracked). Keys were pasted in chat earlier → rotate when convenient.
- 2020 is absent everywhere (COVID); per-season strings skip it.

---

## 6. STILL TODO
- Supabase write-path (predictions → website) + weekly orchestration runner + persistent CLV ledger.
- Optional: market-anchored totals variant; QB backfill pre-2021; rivalry table FIU fix.
