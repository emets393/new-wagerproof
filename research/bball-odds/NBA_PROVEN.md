# NBA — what is actually proven

Written 2026-07-31. This is the ledger, not a narrative: ~90 NBA briefs live in this folder and
the findings that survived are scattered across them. Everything below carries the brief it came
from, so any number here can be traced back and re-checked.

**The bar for appearing on this page.** A result is "proven" when it has been graded against the
**T-60 close** (our closing-line policy — see `closing-line-definition` memory), quoted next to
**its own slice's baseline** rather than 50%, broken out **per season**, and put through a null or
placebo that prices the search that found it. Anything that cleared some of those but not all is
in §5 as TRACK, not up here.

Two layers, per the product framing: a **prediction** for every game and market, then **signals**
layered on the subset that qualifies. §1 is the prediction layer, §2 the signal layer, §4 is the
gap between what is proven and what production actually publishes.

---

## 1. Prediction layer — what the models do

| Market | Best model | oos corr | Bet rule | n | win% | base% | edge | ROI | Brief |
|---|---|---|---|---|---|---|---|---|---|
| **FG total** | ridge, 399 cols (383 base + 16 travel-load) | **+0.0726** | \|resid\| ≥ 2 pts | 2,313 | 54.0 | 50.5 | **+3.5** | **+3.1** | `NBA_TRAVEL_LOAD.md` |
| FG total (prior) | ridge, 383 cols | +0.0672 | \|resid\| ≥ 2 pts | 2,280 | 53.7 | 50.4 | +3.3 | +2.5 | `NBA_TOTAL_V2.md` |
| **1H spread** | signal-space, 120 feats, 3 clf × 5 seeds | not stated | top 25% conf | 805 | 53.9 | — | +2.8 | +2.8 | `NBA_H1_SPREAD_VALIDATE_BRIEF.md` |
| FG spread | — | — | — | — | — | — | — | — | **no model beats the line** |
| ML / win prob | production classifier | +0.373 | — | — | — | — | — | — | verified in prod |

**FG total is the one to ship.** Validation on the 399-column version: label-shuffle null z = **+4.68**
(corr) and **+3.22** (edge); matched placebo — the same 16 travel columns permuted onto the *wrong*
games within season — z = **+3.66**, with the placebo mean landing *below* base, which is what should
happen. Leave-one-family-out: no single family carries it (corr 0.0690–0.0736). Robustness
(`NBA_TOTAL_V2_ROBUST.md`): 70% random feature subsets give edge +2.6 to +3.9; alpha and min_train
sweeps stay +1.9 to +3.9. So the ±0.7 swing is the honest error bar on any single cell here.

**1H spread is real but modest.** Null z = +2.15 (top25%) and +2.33 (top10%). It is *not* S8
wearing a hat — on non-S8 games alone it still grades 53.4% / +1.8% at top25%. Caveat kept in
view: per-season is 57/52/51 (top25%) and 59/52/52 (top10%), i.e. front-loaded in 2023. Graded at
T-60, which is the harder bar, because 1H lines only exist at T-60 in this data.

**FG spread has no working model and that is a finding, not a gap.** Pooled sides models return
negative R² in 15 of 16 feature × model cells (`NBA_SIDES_MODEL_BRIEF.md`). The spread edge we
have comes from *rules* (§2), not from a model. Phase-specific fits look strong in places —
playoffs top25% at 69.0% / +31.8% — but on n=71 across 384 tested cells, which is inside what noise
produces; treat `NBA_SPREAD_V2/V3_BRIEF.md` as a map, not a result.

**Two model facts worth not relearning:**
- The opponent-adjusted **scoring** ratings were broken — the ridge had no global intercept, so the
  ~114-point base was carried by penalised coefficients and flattened to 65.5. Fixed in
  `build_nba_features.py`: `h_adj_off` vs closing total went **−0.0150 → +0.3770**, `sum_tempo` to
  **+0.6436** (`NBA_ADJ_RATINGS_FIX.md`). Betting gain was marginal; the accuracy repair is the point.
- **A neural net is not the answer here** (`NBA_NN_BAKEOFF.md`). Identical folds/features/target:
  ridge +0.0672 vs MLP +0.0470. Learning curve at min_train 800/1500/2500 — ridge
  +0.0492/+0.0672/+0.0784, MLP +0.0433/+0.0470/+0.0642 — the gap **widens** with data, so capacity is
  not the binding constraint. Predictions correlate +0.746: the MLP is reconstructing the same
  linear combination less accurately, which is what a diffuse sum-of-weak-terms signal predicts.

---

## 2. Signal layer — rules that beat their own baseline

| # | Trigger | Market | win% | base% | ROI | n | Per season | T-60? | Brief |
|---|---|---|---|---|---|---|---|---|---|
| **S9** | Late season (both 50+ gp) + home team eliminated or tanking → **back the favourite** | FG spread | **62.3** | **53.05** | **+19.03** | 324 | 60/58/68/63 | **yes** — 58.7% / +12.06 | `NBA_DEAD_HOME_ROBUST_BRIEF.md` |
| **S10** | Shooting heat concentrated in 1–2 high-volume players, measured vs each player's **own** career finishing rate → **fade that team** | FG spread | **54.0** | **50.4** | **+3.2** | 446 | +3.1/−0.5/+7.4 | **yes** | `NBA_CONC_WALKFORWARD_BRIEF.md` |
| **S7** | Both teams on the **same** 3+ game 1H over/under streak → **fade the streak** | 1H total | **61.9** | 50.0 | **+18.1** | 113 | 57/60/67 | blocked | `NBA_HALVES_BRIEF3.md` |
| **S8** | One moderate scorer (18–25 ppg) **freshly** out, opponent healthy, \|spread\| < 8, both 25+ gp → **back the depleted team** | 1H spread | **60.9** | 50.0 | **+16.0** | 271 | 63/60/60 | blocked | `NBA_HALVES_BRIEF2.md` |
| **S11** | S9 **and** the dead home team has played in **2+ different arenas in the last 7 days** → back the favourite | FG spread | **60.8** | **52.65** | **+16.08** | 273 | +21/+6/+25/+12 | **yes** | `nba_hunt_survivors.py` |
| **S12** | Final ~2 weeks of the regular season (`st_h_season_frac ≥ 0.94`) → **OVER** | FG total | **56.8** | **50.70** | **+8.38** | 273 | +5/+12/+16/+1 | **yes** | `nba_hunt_survivors.py` |
| **S14** | Project the margin from both sides' last-3 scoring and allowing; when that projection beats the spread by more than ~4 pts in the home team's favour (top quartile) → **back the AWAY team** | FG spread | **55.5** | **50.19** | **+5.92** | 856 | 57/56/53/55 | **yes** — identical at the open | `nba_conj_hunt.py`, `nba_s13_drill.py` |
| **S15** | Home team has **exactly two more days of rest** than the visitor → **back HOME** | FG spread | **58.7** | **50.35** | **+12.17** | 206 | 54/57/61/66 | **yes** | `nba_catalog_round2.py`, `nba_s13_drill.py` |
| **S17** | **Away favourite** whose last game was a win by **20+ points** → back it | FG spread | **57.4** | **49.23** (any away fav) | **+9.64** | 264 | 54/66/55/55 | **yes** | `nba_dims_t2.py` |

**S9, S11 and S12 can ship today** — they need schedule and standings only, no injury feed. S11 is
the one to actually fire: it is S9 with a second condition, and it beats S9 on ROI, on z, and on
per-season consistency at 83% of the volume.
Its controls are the reason to trust it: the *away* team being dead is null (53.7%, delta cell
**−0.48**), a bad-but-alive home team is 50.8%, a *clinched* home team is 49.2% — so it is quitting
specifically, not team quality, not venue. 18 distinct dead home teams; dropping the most profitable
one still leaves 61.0% on n=310. Note the baseline is **53.05%**, the blind-favourite rate across all
1,817 late-season games — against a naive 50% this rule would look 9 points better than it is.

**S10's load-bearing detail is the own-baseline subtraction.** The same rule without it scores
**−7.9% ROI**; team-aggregate luck in the same cell is −1.7%, p=.77. Player granularity vs the
player's own norm *is* the signal. Threshold was picked walk-forward on prior seasons only and
applied blind — the in-sample HHI sweep is non-monotone (p50 +2.8, p60 +1.8, p70 +6.2, p80 +3.2),
which is the fingerprint of an overfitted cut, so the walk-forward numbers are the production ones.

**S7 and S8 are conjunction rules — the univariate versions are dead.** One team on a 3+ 1H streak
is 50.2% / −4.2%. S8's dose curve is an inverted U (8-15ppg 50.9%, 20-25ppg 59.3%, 32+ppg 48.5%):
the market over-adjusts for a rotation scorer and under-adjusts for a real star. Its placebo is the
one that matters — **stale** absences of the same size score 51.2% / −2.4%, so it is fresh news being
mispriced, not absence itself. S7 does not transfer to the full-game total (51.3% / −2.0%); the
mispricing is 1H-specific.

**S11 supersedes S9 — same idea, one more condition, better on every axis.** The 2×2 is why it is
believable rather than a tighter cut of a rule we already had:

| | tired (2+ arenas / 7d) | not tired |
|---|---|---|
| **home team dead** | **60.81% / +16.08%** (n=273) | 47.27% / −9.72% (n=55) |
| home team alive | 52.17% / −0.39% (n=1288) ← control | 48.38% / −7.66% (n=308) |

Load *without* the motivation story is flat, which is the control that had to hold. The dose ladder
inside the dead cell is a hump, not a cliff — venues≥1 +11.75 (z=2.14, this is plain S9), **≥2 +16.08
(z=2.70)**, ≥3 +15.67, ≥4 +12.35 — so ≥2 keeps 83% of S9's bets and lifts ROI by ~4.3 points. 19
distinct dead home teams, top share 10.6%, and dropping Utah / Washington / San Antonio each *improves*
it. Matched random-cut placebo **p=0.0005**. Stronger at the opener (+24.45%, z=3.99) but it survives
the T-60 close, which is the bar. Drop-any-season leaves z at 2.03–2.63.

**S12 is a calendar effect and is NOT tanking wearing a hat.** Split the final-2-weeks window by
whether the home team is dead: dead +9.07%, **not dead +8.15% on n=203** — near-identical, so it stands
on its own. The disjoint calendar ladder for OVER is −1.18 / −5.44 / −8.51 / −0.09 / +0.01 / **+11.04**
across season-fraction sixths, i.e. the whole effect lives in the last ~3%. Placebo p=0.020.
Note the *spread* version of the same window **is** tanking in disguise (dead 65.71% vs not-dead
52.94%), so it was deliberately not promoted. Also unchanged from close to open (+8.38 → +8.39):
this is a scheduling/effort fact, not a news-latency artifact.

### S14 — fade the amateur handicapper's projection

Take the last three games. Compute what a stat-page handicapper would compute: half of (home's points
scored minus away's points allowed) plus half of (home's points allowed minus away's points scored) —
i.e. a projected margin built purely from recent scoring — and subtract what the spread already asks
the home team to beat. When that leftover is large and positive, the recent numbers "say" the home
team should be laying more than it is. **Back the away team.**

It is dose-graded, which is the test a mined cut fails:

| cut (top X% of the projection-minus-line distribution) | n | win% | base% | ROI | z |
|---|---|---|---|---|---|
| top 44% | 1532 | 52.87 | 50.19 | +0.94 | 2.09 |
| top 35% | 1196 | 54.10 | 50.19 | +3.27 | 2.69 |
| **top 25%** | **856** | **55.49** | **50.19** | **+5.92** | **3.09** |
| top 15% | 508 | 55.12 | 50.19 | +5.19 | 2.21 |
| top 9% | 338 | 56.51 | 50.19 | +7.82 | 2.31 |
| top 5% | 170 | 53.53 | 50.19 | +2.15 | 0.86 |

**Neither ingredient works alone, which is the whole point of it being a conjunction:**

| variant | n | win% | ROI | z |
|---|---|---|---|---|
| S14 (projection minus line), top 15% | 508 | 55.12 | **+5.19** | 2.21 |
| price only — home is a big favourite | 556 | 46.40 | −11.38 | −1.78 |
| form only — home's recent margin is high | 536 | 48.51 | −7.36 | −0.77 |
| form only — home has been scoring a lot | 540 | 51.11 | −2.41 | 0.43 |
| form high but the signal is **not** (line already caught up) | 503 | 47.32 | −9.62 | −1.28 |
| signal high but form is not (line is behind a modest team) | 475 | 54.32 | +3.66 | 1.79 |

So "fade the hot team" loses money and "fade the big favourite" loses more; it is the **difference
between the two** that pays. Mechanically: recent scoring over-extrapolates because it carries pace,
opponent quality and shooting variance the market has already discounted.

Where it lives: almost entirely on games where the **home team is a dog** (n=425, 55.76% vs a 50.83%
in-slice base, +6.42%, z=2.03) and in the **late** season (both 50+ gp: 57.14%, +9.03%, z=2.48; early
−9.47%, mid −0.73%). All four seasons positive (57.3 / 56.4 / 52.8 / 54.6). 30 distinct away teams,
top share 9.1%, worst drop-one-team leaves z=1.86. Corrected random-cut placebo **p=0.0104**. ROI at
the **opener is +5.23% against +5.19% at T-60** — identical, so this is not news latency.

**Two honest weaknesses.** (1) The mirror is flat: the bottom of the same distribution → back HOME
does not pay at L3. (2) The window ladder is unstable — L5 is weaker throughout and **L10 flips sign**
(there the profitable half is bottom → back home, z≈2.4). A real effect should not reverse when you
add seven games of the same measurement. Until that resolves, S14 ships at L3 only and is watched.

### S15 — exactly two extra days of rest

The rest ladder is the cleanest structural finding in the NBA work, because the direction was
**predicted before it was measured**. The dual-outcome regression said the market prices rest
**linearly** (+1.73 pts for one extra day, +1.84 for two-plus) where the true effect is **convex**
(+0.83 real at one day, +3.73 at two-plus). That predicts one extra day is over-paid and therefore a
losing bet, and two extra days is under-paid and therefore the cell. The ATS ladder says exactly that:

| rest gap (home minus away) | n | win% | base% | ROI | z |
|---|---|---|---|---|---|
| home 2 fewer days | 160 | 48.75 | 50.35 | −6.86 | −0.40 |
| home 1 fewer | 783 | 50.70 | 50.35 | −3.15 | 0.20 |
| equal | 2680 | 50.71 | 50.35 | −3.15 | 0.38 |
| **home +1 day (over-paid)** | 951 | 47.74 | 50.35 | **−8.85** | −1.61 |
| **home +2 days** | **206** | **58.74** | **50.35** | **+12.17** | **2.41** |
| home +3 or more | 52 | 51.92 | 50.35 | −0.93 | 0.22 |

All four seasons positive (54.1 / 57.5 / 61.0 / 65.9). Corrected placebos: gap ≥2 **p=0.0122**,
gap exactly 2 **p=0.0075**, gap ≥3 p=0.4627 (the ≥3 tail is n=52 and is noise either way).

### S17 — away favourite off a 20-point win

The right comparator is not all games, it is **other away favourites** — and that population is bad:
49.23% ATS, −6.01% ROI across 1,928 team-games. Inside it, the split on the previous result is sharp:

| away favourite, previous game | n | ATS% | ROI | pts vs its own spread |
|---|---|---|---|---|
| won by 20+ | **264** | **57.42** | **+9.64** | **+1.74** |
| won by less than 20 | 920 | 46.10 | −11.98 | −1.02 |

So this is not "back teams off blowouts" bolted onto "back away favourites" — the same population goes
from bad to good on one condition. Dose is monotone from 15 upward (≥10 +0.71, ≥15 +0.64, **≥20 +1.74**,
≥25 +1.92, ≥30 +1.54), all four seasons positive (+0.22 / +3.92 / +2.14 / +0.58), dropping any of the six
most frequent teams leaves it at 57.1–58.5% and +9.1 to +11.7% ROI, placebo **p=0.0063**. It also works in
both halves of the season (late 60.4%, early 55.3%), so it is independent of S9/S11.

**The threshold is 20, not 15.** At 15 the rule is not there (+0.64 points, 51.99%, −0.73% ROI) and the
disjoint 15–20 band is actively bad (42.47%). Anyone carrying this trend at 15 points is carrying a
version that does not work.

Mechanism, and it checks out: a 20+ win usually means the starters watched the fourth quarter. The effect
is **stronger when the blowout was at home** and the team now travels (+2.72 points, 59.26%, +13.17%) and
strongest of all on short rest (+4.04 on n=42 — small, quoted as colour). Fresh legs into a market that
shades toward "due for a letdown".

### S16 — deep road trip × high-pace team (TRACK, not a bet)

Real as an *effect*, not viable as a *bet*, and the distinction is the point. A top-third-pace team three
or more games into a road trip covers 47.4% and loses 1.32 points against its own number (placebo
p=0.0023). Every one-term control is flat, which is what makes the interaction believable:

| | n | pts vs spread |
|---|---|---|
| leg 3+ **and** fast | 509 | **−1.32** |
| leg 3+, not fast | 1010 | +0.21 |
| fast, leg 1–2 | 1113 | +0.03 |
| fast, at home | 1585 | −0.23 |
| every road team | 4978 | +0.01 |

And it grades with trip depth for fast teams only — leg 1 +0.63, leg 2 −0.96, leg 3 −0.59, leg 4 −1.36,
**leg 5+ −3.00** — while the same ladder for everyone else is flat at every leg (+0.11 / +0.39 / +0.38 /
+0.12 / −0.08). That contrast is the cleanest architecture result in the NBA work.

**Why it is TRACK anyway.** Priced on the side actually bet (the opponent's number, not the flagged
team's), the fade returns **+0.70% ROI** — break-even after vig. Only 2 of 4 seasons are profitable. And
the pace threshold peaks at exactly the 66th percentile where it was set (50th −0.50, 60th −0.78, **66th
−1.30**, 75th −1.08, 85th −0.97), which is the mined-number fingerprint. Two sub-cells are leads rather
than rules because both were chosen after seeing the ladder: leg 5+ fast teams fade at 59.6% / +13.90% on
n=111, and the whole effect lives **before both teams reach 50 games** (+3.17% ROI early, dead late).

The total half of the owner's hypothesis is directionally right and statistically weak: these games run
+1.07 points over the posted number in excess of the sample's own over-lean, 54.3% over, t=1.38.

**It is the rest gap, not the back-to-back.** The plain "away team on a b2b, home team is not" rule at
any gap is worthless — 50.78%, z=0.21. Post-hoc sub-cuts (small n, chosen after seeing the cell, so
treat as colour not as rules): gap ≥2 with the away side **not** on a b2b = 63.83% on n=94 (+21.90%);
gap ≥2 with the home team a **dog** = 61.90% on n=84 (+18.25%).

---

## 3. Model ingredients — real, but never put these on a card

- **Cumulative travel load** — `km_7d`, `km_14d`, `venues_7d`, `days_since_home` × h/a/sum/d. Worth
  +0.0054 corr and +1.0 edge *inside* the totals model; **standalone it grades +0.2 edge**. Acute
  geography (tonight's flight, time zones, altitude, body clock — 38 columns) lands **below** base and
  was diluting the 16 that worked. Why the frame missed it: `h_sched_g_last7` counts *games*, so a
  four-game homestand and a four-city road swing are the same number. `NBA_TRAVEL_LOAD.md`.
- **RAPM-valued absences** — 54.1% vs the **opener** (+3.3% ROI, n=800) but **+0.0% ROI at T-60**. That is
  a news-latency/CLV artifact, not an outcome-forecasting edge. Keep as a feature, never a rule.
  `NBA_ABSENCE_SUMMARY.md`.

---

## 4. The gap: proven vs published

Production scores from `~/Documents/cfb_automation/scripts/cfb/run_nba_predictions.py`.

| Published column | State |
|---|---|
| `home_win_prob`, `model_fair_*_moneyline` | Real — corr +0.373 |
| `model_fair_home/away_spread` | **corr ~0.000** — back-derived from the ML probability via `prob_to_spread(p_home_win)` |
| `model_fair_total` | **corr −0.017** |
| `home/away_score_pred` | Back-solved from fair total & spread, inherits both |
| 1H spread / 1H total, cover% / over% | Columns do not exist |

The cause is verified at `run_nba_predictions.py:241-242` — `spread_model.predict_proba(...)` and
`ou_model.predict_proba(...)` are both computed and assigned to `_p_home_cov` / `_p_over`, marked
`# currently unused`, and discarded. **Two trained classifiers are thrown away and the spread we
publish is the moneyline model wearing a hat.** Fixing this is the highest-value item on the board:
it converts two cosmetic numbers into real ones without any new research.

**Also not yet landed:** `nba_model_features.parquet` has not been regenerated since the ratings
fix, so that repair has not reached the frame; and there are **zero saved NBA model artifacts**
(no `data/artifacts` directory), so nothing above can be scored in production as-is.

---

## 5. Closed and do-not-re-chase

- **Team-level luck regression — null in every market, four independent designs.** 352-cell sweep,
  family-wise p=.173; decile gradients flat; walk-forward ROI −0.9%; the placebo (shot *rates*)
  outscored every real luck feature. Replicated as null in NCAAB on 4× the sample. `NBA_LUCK_*`.
- **Travel's acute story** — red-eyes, three time zones, Denver's air. Not in this data. Four direct
  tail cuts all failed once priced against a matched-size random cut: visitor unacclimatised at
  altitude looked +4.5 on n=343 but is z=+1.47 and 2-of-4 seasons. `NBA_TRAVEL.md` §4, `_SPREAD.md`.
- **Travel/clock features on the spread** — 7 columns cleared the univariate noise floor and it still
  died in-model at **z = −0.19**. A univariate fingerprint is a hypothesis, not a result.
- **Prop line shopping** — best vs 2nd-best line collapses +18.68% → −0.68% ROI. Stale outlier.
- **Bottom-up player-ceiling and RAPM level models** — negative R² on 1H margin, 1H total, FG margin.
- **Cold-favourite 1H continuation** — the contrarian hypothesis was backwards: 46.0% / −12.2%.

### The 2026-07-31 signal hunt — what it closed

Run as `nba_hunt_validate.py` (152 pre-registered rules, stage A) → `nba_hunt_deepdive.py` →
`nba_hunt_round2.py` (69 more) → `nba_hunt_survivors.py`. Two of the three things it produced are
negatives, and they are more useful than the signals.

**1. Blind wide filter search does not transfer. This closes the "try every combination" route.**
Stage B built 375 features → 15,443 masks → **308,860 cells**, fit the cut thresholds *and* picked
the winners on 2022-23 + 2023-24 only, then graded the 1,859 cells that cleared z≥2 on held-out
2024-25 + 2025-26. Mean excess ROI **−0.017%** against a permutation null of +0.001% ± 0.006,
**p = 1.0000**; share of picks staying positive **42.9%** vs null 50.5% ± 4.8. Worse than chance.
The diagnosis matters more than the number: a family-wise max-z bar over 233k blind cells sits at
**4.46**, and S9 — our best NBA signal — scores **2.04** at T-60. *A blind marginal sweep can never
surface a real NBA-strength edge.* The search design was the binding constraint, not the data.
Anything found this way needs pre-registration, walk-forward OOS on an aggregate statistic, and
mechanism controls — not a lower p-value.

**2. Every family the owner named is priced.** Stage A's null 95th percentile was 3.01 over 142 live
cells (median 2.27). Calibration held (S9 z=2.14; the away-dead control z=−0.03). Family medians:

| Family | median ROI | max z | verdict |
|---|---|---|---|
| standings / motivation | **+1.45%** | 2.22 | the only live family — S9/S11/S12/S13 come from here |
| context (Cup, divisional, b2b, rest) | ~0 | — | priced |
| early-season totals bias | ~0 | — | priced |
| last-3 / last-5 form, ATS & SU streaks | −5.61% | — | priced |
| head-to-head / last series vs same team | ~0 | — | priced |
| form measured **against this game's line** | **−5.90%** | — | priced |
| power ratings vs the line | **−5.77%** | — | priced (see the bug fix below) |
| regression deltas (d3 / d5) | ~0 | — | priced |
| line movement | ~0 | — | priced |

**Two corrections that were nearly shipped as findings:**
- **`rt_total_gap` had a scale bug that silently voided the whole ratings-vs-line totals family.**
  `h_adj_tempo_pts` is already a full-game total estimate for that team's games (league mean 226.7),
  not the points that team scores, so `h + a` gave 453 and `rt_total_gap` came out with mean +225 —
  every cut on it was really "bet the over when the total is high." Fixed to an average in
  `nba_hunt_build.py` and re-tested; the family is now honestly dead (gap≥3 per season
  −6.7/+2.8/−5.1/−10.8), but for a while it read as dead without ever having been tested.
- **The highest-z cell in round 2 (`m9_predl_tank_fav`, z=3.06) was a comparator artifact.**
  `st_days_to_deadline > 0` means *after* the deadline, not before, so the registered "pre-deadline
  control" was the identical cell to the post-deadline rule (both n=308, identical win%). Its z came
  entirely from grading against the all-season 50.04% blind-favourite base instead of the correct
  post-deadline 52.42%. **Honest z = 2.23.** Same baseline mistake as the original S9 write-up.
- **Lust (2018)'s continuous elimination ratio does not replicate here.** Its mechanism control fails
  flat: dog-out/fav-alive +0.89%, both-out +1.19%, fav-out/dog-alive +0.99% — indistinguishable, so
  it is late-season favourite bias, not elimination pressure. 2023-24 at −5.74%.

TRACK-only, not proven: divisional 1H under rematch (53.1%, decaying 59→49→52), cold-fav 1H fade
(54.0% / +3.0%, 56/56/50), H2H ATS anti-persistence (55.5%).

**S13 — late season, both teams settled (eliminated *or* clinched) → OVER.** 467 bets, 56.10% vs a
51.04% in-slice base, **+7.11%**, z=2.19, placebo p=0.0085, corroborated in the home team total
(z=2.53). It is held back from §2 by one thing: **drop 2023-24 and it goes to +3.37% / z=0.86** while
S11 and S12 barely move under the same test. Its ladder is also a step, not a gradient — 0 settled
−5.88%, 1 settled −4.83%, **2 settled +7.11%**. Defensible mechanically (a no-show game needs both
sides to no-show) but it is one season carrying a rule until another April says otherwise.

Non-monotone and treated as noise: early-season dogs (gp1-5 +9.47%, gp6-10 −7.27%, 2025-26 negative).
The rest ladder was parked here too and has since been **promoted to S15** — see §2. What changed is
that the non-monotonicity turned out to be the *prediction*, not a defect: the dual-outcome regression
had already said the market's rest slope is linear where the truth is convex, which requires +1 to
lose and +2 to win. A ladder that matches a mechanism stated in advance is evidence, not noise.

### The conjunction hunt — combinations of features with tunable thresholds

`nba_conj_hunt.py` → `nba_s13_drill.py`, 2026-07-31. Built because every prior NBA search cut on
**one feature at a time** (`nba_hunt_validate.build_masks_oos` literally loops `for c in cols:`), so
"308,860 cells" was 308,860 single-feature slices, not combinations. This run is the combination
search: **125 templates** across 14 mechanism families, each a 2- or 3-term conjunction of the form
*team A's feature ≥ X **and** team B's feature ≤ Y*, with thresholds swept over a grid
(≥55/65/75/85th pct × ≤45/35/25/15th pct) = **2,216 threshold combinations** graded against
**9 markets** (FG spread both sides, FG total both sides, FG ML both sides, 1H spread, 1H total both
sides, both team totals). Every template carries a written mechanism; no mechanism, no template.
Families: style mismatch (shot diet vs what the defence concedes), pace confluence, rebounding and
turnover mismatch, quality mismatch, thin rotation × fatigue, form vs the posted price, ratings vs the
market, own-baseline shooting regression × opponent defence, first-half share, travel density × rest,
naive form projection, line movement × form, streaks × price, and context flags.

**Result: the tuned version is aggregate-null in both split directions, and the tuning is the noise.**

| pass | rules selected on FIT | mean excess ROI on TEST | positive rules | FIT→TEST shrinkage |
|---|---|---|---|---|
| forward (fit 22-23/23-24, grade 24-25/25-26) | 118 | **+0.18% ± 0.64** | 61/118 (chance ≈59) | +5.49 pts |
| reversed (fit 24-25/25-26, grade 22-23/23-24) | 104 | **−1.95% ± 0.93** | 37/104 (chance ≈52) | +9.40 pts |

22 of 100 templates were positive both ways, where chance is ~25. **A conjunction search with tuned
thresholds fails the same way a blind single-feature sweep does** — this closes the "tweak the
parameters until it hits" route as firmly as the earlier sweep closed the marginal one.

**Pass 3 fixed the thresholds a priori** (one cut per term, 70th/30th pct, graded on the whole
sample), which collapses 2,216 cells to ~125 tests and drops the family-wise bar to something a real
edge can clear (expected max |z| ≈ 2.7):

| pre-registered cut | mean excess ROI | positive | max z |
|---|---|---|---|
| 0.70 / 0.30 | −0.92% | 47/120 | +2.47 |
| 0.60 / 0.40 | −0.38% | 59/121 | +1.94 |
| 0.80 / 0.20 | −1.41% | 45/113 | +2.32 |

Exactly **one** template cleared z≥2.0 *and* 3-of-4 seasons positive *and* survived the forward
walk-forward: the naive-scoring-projection fade, promoted as **S14**. One survivor out of 125
pre-registered mechanism-backed conjunctions is the honest yield.

**Three templates lost badly in the registered direction and win in the reverse.** Reversals are
hypotheses, not findings — they are graded here so the mechanism can be stated, and all three sit
below z=2.0 with uneven seasons, so they are TRACK-only:
- *clean-whistle game → OVER* (low home FT rate into a low-fouling defence; few whistles = running
  clock = more possessions): L5 n=384, 55.21% vs 50.25 base, +5.39%, z=1.94; L10 z=1.99. 2025-26 negative.
- *top-heavy away side on a back-to-back → OVER* (n=179, 56.98% vs 50.25, +8.79%, z=1.80) — a tired
  star-dependent team loses its defence before it loses its shot-making, so the game runs up, not down.
- *home pushed into threes → home team total UNDER* (L5 n=299, 55.85% vs 50.60, +6.10%, z=1.86; **L10
  flips to −7.54%**) — three-point volume forced by the defence is the low-efficiency diet, not the high one.

**And one clean negative worth keeping: the move beats the form.** The registered contrarian rule
("line moved against the home side but its recent form disagrees → fade the move") lost, and
following the move instead returns 54.95% vs 50.19 base on n=424 (+4.91%, z=1.96). But the control —
*any* move off the home side → back away — is already 52.64% (z=1.84), so the form condition adds
about 2 points on a quarter of the sample. That is a line-movement fact, not a conjunction finding.

### A units bug in the placebo test voided several earlier "null" verdicts

`nba_hunt_deepdive.placebo()` takes `observed_roi` **in percent**. Three call sites passed
`r['roi']/100`, which silently changed the test from "beat +5% ROI" to "beat +0.095% ROI" against a
market whose base ROI is −3.85% — that returns p ≈ 0.25 for *any* cut regardless of quality
(P(Z ≥ (0.095+3.85)/6.2) = 0.262, matching the 0.2265 that was observed and reported as null).
Fixed in `nba_catalog_tests.py` (×2) and `nba_hot3_round2.py` (×1); a warning docstring is now on
`placebo()`. Corrected p-values: rest gap ≥2 **0.0122** (was 0.2265), gap exactly 2 **0.0075**,
home-favourite-off-a-blowout **0.0088**, S14 **0.0104**. `nba_hunt_deepdive.py`,
`nba_hunt_survivors.py` and `nba_hunt_style.py` always passed it correctly, so **S9–S13 are
unaffected**.

### The situational-attribution scan — scenarios measured in POINTS, split by team architecture

`nba_dims_build.py` → `nba_dims_scan.py` → `nba_dims_validate.py` → `nba_dims_t2.py`, 2026-07-31.
A different question from every earlier hunt: not "does this cell hit 55% ATS" but **how many points
does a scenario move the margin and the total, and does that change with what kind of team is in it.**
Three things had to be built first, none of which the research frame had: **road-trip structure**
(leg number, trip length, games remaining, plus the schedule *lookahead* — legal, the schedule is
public), **opponent-style sequence** (the pace of the last three opponents, valued as they were then),
and **rotation experience** (minutes-weighted years-since-draft over the trailing 10 games — 87% of
minutes covered; balldontlie has draft year, not birthdate, so it is experience and not literally age).

**The single most important correction this scan produced: the total has a baseline of +0.72.**
Games in this sample run +0.72 points over the closing total on average. Scoring a cell against zero
roughly doubles its t-statistic. The lead with the highest t in the raw scan — "coming off three slow
opponents → OVER", t=3.47 — collapses to **t=0.31** once measured against +0.72. It was the baseline,
not a signal. Any total-side number in this repo quoted against zero is wrong by construction.

**Architecture is enormously real and almost entirely priced.** The pace 3×3 on raw game total runs
from **219.4** (slow into slow) to **237.6** (fast into fast) — an 18-point spread, the largest clean
gradient anywhere in the NBA work. The same grid measured *against the posted total* is flat: every
cell sits between −0.0 and +1.6, and fast-into-fast is +0.68. The market knows exactly what pace does.
This is the answer to "does opponent architecture matter": hugely for what happens, barely for what
is mispriced. Never a card — and, per the in-model test below, not a feature either.

**Age/experience matters only in interaction with fatigue, only on the total, and not enough to bet.**
The ordering is coherent — veteran rotation while fatigued (b2b or heaviest-quartile travel week)
**+0.69** excess points, young rotation while fatigued +0.08, veteran rotation fresh −0.30, and the
main effect of experience alone is ~0 as it should be. But the top cell is t=1.32 with 2025-26
negative. Old legs stopping defending first is real, and it is not a rule.

### The "model ingredient" claim was tested and it is FALSE

Architecture, rotation experience and road-trip depth were all filed above as *ingredients, not
bets*. That claim was never tested when it was made. It has now been tested on both markets and it
does not hold. `nba_total_v4.py` → `NBA_TOTAL_V4.md`, `nba_spread_dims.py` → `NBA_SPREAD_DIMS.md`.

52 situational columns (schedule/trip structure, pace and defensive-efficiency levels, rotation
experience, travel load, plus explicit pace×pace, leak×leak, experience×fatigue and trip×pace
interactions) added to the round-3 incumbent:

| total model | cols | oos corr | edge | ROI |
|---|---|---|---|---|
| round 3 incumbent | 403 | **+0.0725** | +3.0 | +2.2 |
| + situational dims | 455 | +0.0653 | +3.5 | +2.2 |
| situational dims ALONE | 52 | +0.0009 | −2.5 | −7.6 |

Correlation falls. The edge moves +3.0 → +3.5 against a **null sd of 0.86** — a half-sigma move, i.e.
nothing. Every theme added alone lands at or below the incumbent (sched +0.0728, trav +0.0716, arch
+0.0706, exp +0.0700). Drop-one is the sharpest result: removing the **interactions** *improves* the
model to edge +3.8 / ROI +2.8, the best row in the file. They are noise with a story attached.

On the spread — the market where S16 and S17 actually live, and the one with no working model —
the result is flat zero: base corr +0.0137, with dims +0.0088, dims alone −0.0074, against a null
sd of 0.0146. **z = +0.18 on corr and −0.16 on edge.** Every threshold from 0 to 5 points, every
season and every phase grades below its own baseline.

**Why, and this is the transferable part.** The information is real but **conditional, not linear**.
S17 is a 264-game cell defined by a conjunction — away, favourite, off a 20+ margin, fresh legs.
Smeared across 5,423 games as continuous columns it dissolves. That is the mirror image of usage
concentration, which is genuinely diffuse and therefore found by a ridge and by no rule. The lesson
is a matching rule: **diffuse effects belong in the model, conditional ones belong in the rule
layer, and moving either one across that line destroys it.** Cumulative travel load remains the only
situational block that ever earned a model slot.

Two more leads that did not survive their own season split, kept here so they are not re-found:
- **Rest mismatch (either side 2+ days) → OVER**: +1.95 excess points, placebo p=0.0020, but per
  season +4.73 / −0.88 / +2.74 / +0.54 — 2022-23 carries it. The dose also breaks (gap 3+, n=72, dies).
- **The owner's "sandwich"** (mid-trip, one day off, road game next): +0.24 points, t=0.33, and per
  season +1.99 / −0.01 / **−3.52** / +2.23. The lookahead adds nothing over mid-trip alone. Dead.

What survived is in §2: **S17** (away favourite off a 20+ win) as a bet, **S16** (deep trip × fast
team) as a tracked effect.

### Published rules re-tested on our four seasons

- **Home favourite off a 15+ point win** — fails its own dose test and is NOT promoted. 5+ z=0.68,
  10+ z=1.89, **15+ z=2.24**, 20+ z=0.43, 25+ z=0.51. It peaks at exactly the published threshold and
  dies on both sides, which is the fingerprint of a number that was mined once and copied since. Its
  controls are clean (any home favourite 50.37%, z=0.02) and the corrected placebo is p=0.0088, so it
  is not nothing — but a rule that only works at one arbitrary margin is not a rule.
- **Early-season OVER** — weak but the mechanism is real. Decays with window (first <3 games 56.61%,
  <5 54.81%, <8 54.44%, <10 52.04%), one negative season, placebo p=0.2255. The posted total *is*
  systematically low in early games in 3 of 4 seasons (miss +0.90 / +1.24 / +1.79 vs −0.26 in 2022-23).
- **Reversed favourite–longshot bias** — the published direction is wrong for the NBA moneyline. The
  bias here is **orthodox**: longshots are over-priced at every band (2-10% implied realises 3.9%,
  10-15% realises 10.8%, 25-30% realises 23.6%), so the dog side loses everywhere (−56.8% / −18.4% /
  −10.4% / −12.9%). But laying the favourite is *also* negative at every threshold (−2.78 / −2.81 /
  −4.21 home, +0.14 / −0.81 / −3.26 away) because the vig eats the fade. **This produces a do-not-bet
  rule, not a bet.** The spread analogue is mildly positive: away dog ≤20% implied → back home ATS
  52.91%, +1.01%, z=1.25; either side a big favourite → OVER 53.53%, +2.19%, z=1.65.
- **Visitor travelling 2+ time zones west** — dead once the placebo is corrected. Our regression's
  direction (back home) p=0.9072; the published direction (back the westward road dog) +2.37%,
  z=1.29, p=0.0817.

### Cross-team matchup nets (the NFL construction) — tested on both markets, negative

`nba_matchup_nets.py`. Team A's offensive profile paired against team B's *allowed* profile,
eight stat pairs (four factors both ways plus shot mix) over L5 / L10 / season-to-date, giving
`net_h = home offence − away allowed`, its mirror, and their sum and difference. This is the
construction behind the NFL's 21 matchup nets and it had never been ported to basketball.

The control is what settles it. **RAW** — each team's own offensive and allowed levels, same
data, no pairing — is what must be beaten before the *construction* gets any credit.

| feature set | total edge | spread edge |
|---|---|---|
| base | +2.6 | −1.2 |
| base + RAW own levels | **+3.1** | −1.7 |
| base + NET matchup | +2.6 | **−2.2** |
| base + RAW + NET | +2.8 | −1.8 |
| NET alone | −0.2 | −1.9 |

NET sits *below* RAW on the total and makes the spread actively worse; alone it is worthless on
both. Per-pair (eff, efg, tov, oreb, ftr, trate) every pair is negative on the spread. The
whole-model null on the total is z=+6.58 corr / +2.42 edge, but that is the incumbent model
being real, not the nets adding — the nets question is answered by the RAW row, and it is no.

**Method note that nearly cost a week.** The obvious source, `possession_team_games.parquet`,
has ready-made `*_alwd` columns and a sport-neutral name. It is **college basketball** — 1,008
teams, ~6,100 games a season, sourced from `cbbd_team_box.parquet`. It joined to the NBA frame
at 0.0%, and a looser coverage filter would have quietly trained an NBA model on college
possessions. The allowed side is now derived from `bdl_player_box.parquet` via the identity
that team A's offensive line in a game IS team B's allowed line in that same game — one
self-join on `game.id`. `team_game_box()` asserts ≤32 teams so this cannot recur.

### Opponent-adjusted box stats (the KenPom treatment) — built, and it barely moves anything

`nba_adj_stats.py`. Only four NBA quantities were ever opponent-adjusted (`adj_net`, `adj_off`,
`adj_def`, their sum); eFG, turnover rate, free-throw rate, offensive rebounding, 3PA rate,
3P%, two-point %, and pace were all raw rolling means. All nine are now adjusted by the same
leak-safe per-date ridge (`stat = level + off_A + def_B + home bump`, fitted on that season's
prior games only). Every stat rides the same design matrix, so they solve as one multi-RHS
system — nine stats cost about what one costs.

**The mechanism test is the one with power**, because the betting edge has a null sd near 0.9
and cannot resolve this either way. Does the adjusted rating forecast the team's OWN next-game
value better than a plain average? n=10,084 per stat, no market involved:

| stat | rolling L10 | season-to-date | opponent-adjusted | adjusted + recency |
|---|---|---|---|---|
| `off_eff` | +0.2037 | **+0.2103** | +0.1960 | +0.1960 |
| `efg` | +0.1666 | **+0.1844** | +0.1755 | +0.1746 |
| `tov_rate` | +0.1957 | **+0.2139** | +0.2101 | +0.2055 |
| `ftr` | +0.1931 | +0.1918 | +0.1960 | **+0.2009** |
| `oreb_pct` | +0.2879 | **+0.3014** | +0.2921 | +0.2968 |
| `three_rate` | **+0.5027** | +0.4941 | +0.4743 | +0.4840 |
| `three_pct` | +0.0601 | +0.0855 | **+0.0856** | +0.0805 |
| `two_pct` | +0.1585 | **+0.1717** | +0.1635 | +0.1622 |
| `poss` | +0.3304 | +0.3306 | +0.3413 | **+0.3474** |

Adjusted beats both unadjusted estimates on **3 of 9**, by +0.011 (pace), +0.003 (FT rate) and
+0.0001 (3P%). The plain season-to-date mean wins five of the other six.

**Recency weighting is a wash** — with the half-life correctly expressed in days (40, ≈20 team
games), the recency-weighted ratings land within ±0.01 of the flat ones on every stat, better on
four and worse on five. It is neither the fix nor a trap; there is simply nothing there. An
earlier run showed it catastrophically worse, which was a bug in this repo and not a finding:
the half-life was applied to league-game ROW index, and the league plays ~7 games a day, so a
"20-game" half-life meant about three days. **Any decay weight fitted on a pooled league panel
must be expressed in days, not rows.**

**LAW — opponent adjustment is worth far less in the NBA than in college, and the reason is
structural.** Thirty teams on a balanced 82-game schedule face nearly identical average
opposition, so there is very little schedule effect to remove. A college team can play two
thirds of its games inside one conference, which is why KenPom is load-bearing there and this
is not here. Do not port a college adjustment result to the NBA and assume it transfers.

The 2×2 that separates adjustment from construction — read **down** for the adjustment,
**across** for the matchup pairing:

| | own levels | matchup net |
|---|---|---|
| raw rolling | +3.1 | +2.6 |
| opponent-adjusted | +3.3 | +2.8 |

Adjustment +0.2 in both rows; the matchup construction **−0.5 in both rows**. Consistent in
both, which is what makes it credible, and all of it inside the 0.86 null sd. Adjusting the
inputs did not rescue the nets. Spread null: z=+1.16 corr, +0.81 edge — still no spread model.

### Per-feature audit — half the model is dead weight, and the two markets want opposite things

`nba_feature_audit.py`. Permutation importance on OUT-OF-SAMPLE predictions inside the existing
walk-forward: shuffle one column in the test matrix, re-predict with the already-fitted model.
Negative delta = shuffling hurt = the feature helps. Ridge is linear, so each permutation is a
rank-1 correction to the base prediction rather than a refit. 719 columns, both markets.

**Total — 360 of 719 columns help, 359 hurt.**

| family | cols | helps | total delta | mean delta |
|---|---|---|---|---|
| usage concentration | 96 | 49 | **−0.0595** | −0.00062 |
| possession raw | 96 | 58 | −0.0261 | −0.00027 |
| team form/efficiency | 82 | 39 | −0.0215 | −0.00026 |
| **adj ratings** | 17 | 15 | −0.0187 | **−0.00110** |
| matchup net | 96 | 47 | −0.0124 | −0.00013 |
| adj own levels | 36 | 17 | −0.0022 | −0.00006 |
| adj matchup net | 36 | 13 | +0.0020 | +0.00005 |
| structural | 4 | **0** | +0.0021 | +0.00052 |
| dims sched | 7 | **0** | +0.0025 | +0.00035 |
| dims interaction | 8 | 2 | **+0.0038** | +0.00048 |

- **Usage concentration is the engine of the total model** — biggest helping block by 2×, and six
  of the top ten individual features are minutes/shot concentration.
- **The four original opponent-adjusted SCORING ratings are the highest-value columns in the
  model**, 4× better per column than anything else, 15 of 17 helping. The nine newly adjusted
  four-factor stats land at −0.00006 and +0.00005 — about twenty times weaker. Adjustment pays
  on scoring rate; it does not pay on eFG, turnovers, rebounding or shot mix.
- **`dims sched` and `structural` have a 0% hit rate**, and `dims interaction` is the worst block
  in the model — independently confirming the drop-one result that removing the pace×fatigue
  interactions *improves* it. These three should come out.
- **Window instability is the live lead.** `a_l5_top_min_share` is the single best feature
  (−0.01017) and `a_l10_top_min_share` is the single worst (+0.00552). Same quantity, different
  window, opposite sign — the L5 window carries it and the L10 window is noise the ridge pays for.

**Honest prune test** — rank importance on 2022-23 only, evaluate on 2024-25 which the ranking
never saw. Ranking and scoring on the same seasons always "improves" and means nothing.

| feature set | cols | oos corr | edge | ROI |
|---|---|---|---|---|
| all columns | 719 | +0.0780 | +2.6 | +3.6 |
| pruned to early-season helpers | 351 | +0.0748 | **+3.3** | +3.8 |

Cutting half the model gains +0.7 edge out of sample — inside one null sd, but honestly measured.

**Spread — the ranking INVERTS, and it does not transfer.** Biggest helpers are `dims arch`
(−0.0268) and `dims exp` (mean −0.00238, the highest per-column value in the spread model);
biggest hurter is `possession raw` (+0.0345), which was a *helper* on the total. Adjusted
matchup nets help (−0.0060) where raw ones hurt (+0.0042). Tempting — but the prune test comes
back **negative** (pruned −2.5 vs all −1.3), so the early-season ranking does not carry to later
seasons. **Read this as a caveat, not a finding: feature importance inside a model whose edge is
−1.3 tells you what a losing model leans on, not what wins.** It does say the block-level verdict
on the situational dims was too coarse — architecture and rotation experience were buried under
40 columns of noise when added all at once — but nothing here is bettable.

---

## 6. What blocks each proven thing from shipping

| Item | Blocker |
|---|---|
| FG total model | Regenerate `nba_model_features.parquet`; persist an artifact; wire the 16 load columns |
| FG spread + total published numbers | The two discarded classifiers (§4) — code fix, no research needed |
| S9 / S11 | `nba_slate_flags` table does not exist. DDL written 2026-07-31 (`supabase/migrations/20260731180000_nba_slate_flags_and_h1_odds.sql`) but **not applied** — needs owner approval. S11 additionally needs `venues_7d` (distinct arenas in the trailing 7 days), which `nba_signals_job.py` does not compute today |
| S12 | Nothing. It is a calendar cut on games already in the slate — no new feed, no new column |
| S14 | Needs each team's last-3 points scored / points allowed and the T-60 spread — both already in the daily pipeline. Requires the L3 window specifically (L10 reverses); percentile cut must be recomputed against the trailing season, not hard-coded |
| S15 | Nothing but a days-of-rest column on the slate. Note `h_days_since_home` in the research frame is broken (all zeros) — compute the gap from the schedule, not from that column |
| S10 | Daily hoopR play-by-play pull + expanding expected-points table |
| S7, S8, 1H spread model | **1H odds capture.** Not on the bulk `/odds` call — per-event endpoint only, so it cannot be backfilled after the fact. Needs `nba_odds_snapshots_h1` (same unapplied migration) plus a season of accumulated history |
| S8 additionally | Player position + ppg joined to `nba_injury_report` |

**Only #5 has a hard deadline.** Every day the 1H capture is not running is a day of 1H lines we can
never recover, and two proven signals plus a proven model sit downstream of it.

Related memories: `nba-travel-and-nn`, `nba-total-model-null`, `nba-absence-signal`,
`nba-player-heat-signal`, `nba-team-luck-null`, `bball-movement-research`,
`nba-production-pipeline`, `closing-line-definition`.
