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

Non-monotone and treated as noise despite decent placebo p-values: rest edge (exactly 1 day −8.85%,
exactly 2 days +12.17%, ≥3 flat on n=52) and early-season dogs (gp1-5 +9.47%, gp6-10 −7.27%, 2025-26
negative).

---

## 6. What blocks each proven thing from shipping

| Item | Blocker |
|---|---|
| FG total model | Regenerate `nba_model_features.parquet`; persist an artifact; wire the 16 load columns |
| FG spread + total published numbers | The two discarded classifiers (§4) — code fix, no research needed |
| S9 / S11 | `nba_slate_flags` table does not exist. DDL written 2026-07-31 (`supabase/migrations/20260731180000_nba_slate_flags_and_h1_odds.sql`) but **not applied** — needs owner approval. S11 additionally needs `venues_7d` (distinct arenas in the trailing 7 days), which `nba_signals_job.py` does not compute today |
| S12 | Nothing. It is a calendar cut on games already in the slate — no new feed, no new column |
| S10 | Daily hoopR play-by-play pull + expanding expected-points table |
| S7, S8, 1H spread model | **1H odds capture.** Not on the bulk `/odds` call — per-event endpoint only, so it cannot be backfilled after the fact. Needs `nba_odds_snapshots_h1` (same unapplied migration) plus a season of accumulated history |
| S8 additionally | Player position + ppg joined to `nba_injury_report` |

**Only #5 has a hard deadline.** Every day the 1H capture is not running is a day of 1H lines we can
never recover, and two proven signals plus a proven model sit downstream of it.

Related memories: `nba-travel-and-nn`, `nba-total-model-null`, `nba-absence-signal`,
`nba-player-heat-signal`, `nba-team-luck-null`, `bball-movement-research`,
`nba-production-pipeline`, `closing-line-definition`.
