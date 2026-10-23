# NFL market-model audit — 2026-10-22

Every model that publishes a number to `nfl_slate_games` for the 2026 season, measured against
the line it is supposed to beat. Written because the totals model was found to have no signal at
all; the audit then covered the other markets to see how far that went.

**Status: the totals family is SUSPENDED in code. The spread family ships with a warning.**

## Method

Three diagnostics, on all 93 played 2026 games (not just the games that produced a pick, so the
sample is the whole board rather than a self-selected slice):

| | what it catches |
|---|---|
| `corr(pred, market)` | a model with real information tracks the market strongly, typically 0.7–0.9. Near zero means the two numbers describe different quantities. |
| `corr(pred, actual)` vs `corr(market, actual)` | if the market predicts the result better than the model does, the model's "edge" is just the market's own deviation negated. |
| `sd(pred)` vs `sd(market)` | a model compressed toward the league mean cannot disagree with the market for any reason except the market having moved. |

Plus, for anything that publishes a pick, the graded record at the line that pick was pinned to.
Every grader was oracle-checked first (feed the realised result into the bet rule; it must return
~100%) per `grading-sign-oracle-check`. The spread grader returned 37-0-3 on the oracle and all
40 pick abbreviations matched `home_ab`/`away_ab`, so the records below are trustworthy.

## Results

```
                       n    corr(pred,act)  corr(mkt,act)   MAE pred/mkt    sd pred/mkt   sign
FG margin (spread)    93       +0.146          +0.342       10.28 / 9.19    5.62 / 5.01   38.9%
FG total              93       -0.085          +0.439       12.12 / 10.99   2.69 / 4.43   45.7%
Home team total       93       +0.001          +0.295        7.76 / 7.07     3.00 / 3.71   41.8%
Away team total       93       +0.106          +0.466        8.08 / 7.17     3.21 / 3.42   44.1%
```

(`sign` = of the games where the model disagreed with the line, how often it disagreed in the
direction the result went. Spread/total shown on the open, which is the line those signals bet;
team totals on the close, which is the only line they have.)

**Not one full-game model beats the closing line on MAE, and all four are under 50% on sign
agreement.** The market's own correlation with the result is 2–4× the model's in every market.

### The totals model has no signal

`corr(pred, close) = +0.051`. The model's number is effectively unrelated to the market's, its
prediction sd is 2.69 against the market's 4.43, and it is *less accurate than quoting Vegas*
(MAE 12.12 vs 10.67). Calibration in the mean is fine — pred 45.33, close 44.99, actual 46.17 —
so this is not a bias, it is an absence of information.

Because the market is genuinely informative (+0.439), a model that ignores it produces an edge
which is just the market's deviation from ~45 with a minus sign. That is why the dose-response
runs monotone the *wrong* way:

```
pred - close  <= -6   n=12   went OVER 83.3%
              -6..-3  n= 9             55.6%
              -3..0   n=20             50.0%
               0..+3  n=25             40.0%
              +3..+6  n=16             50.0%
              >= +6   n=11             36.4%
```

**Cause.** 21 of the b15 features are `team_week` `_s2d` columns, which are 8-season franchise
averages rather than season-to-date. Measured in `matchup.parquet` for 2026:

```
BUF off_ppd_s2d:   wk2=2.402  wk3=2.415  wk4=2.413
19 of 31 teams never changed all season
within-team sd across 2026 weeks:  0.0029
between-team sd:                   0.2475      (an 85:1 ratio)
```

The model is computing something close to "team A's 2018-2025 scoring + team B's 2018-2025
scoring + weather". It cannot see this year's offenses, injuries or form, which is exactly why it
does not track a market that can. See [[nfl-team-week-cumulative-defect]].

⚠ This is **not** a train/serve skew. The scale is consistent across 2023-2026 (`ppd` 2.02/2.02/
2.01/2.05), because the 2026-10-02 fix made 2026 cumulative like the history rather than making
the history true season-to-date. Train and serve agree — on a dead feature. The spread model took
the other route on 2026-09-17 and reads `team_week_seasonal.parquet` instead.

### Team totals are a rotation of it, not a third market

`tt_home_pred + tt_away_pred == fg_pred_total` and `tt_home_pred - tt_away_pred ==
fg_pred_margin`, exact on 106 of 107 rows. So each team total is `(total ± margin)/2` and half of
it is the dead totals model. That is the whole explanation for home TT scoring
`corr(pred, actual) = +0.001`. Per [[derived-market-gating-law]], check rotation first — this one
is a pure rotation and inherits the parent's defect directly.

### 1H total — suspended on the anchor, not on a record

`h1_pred_total` is `pred_tot_anch`: anchored on `fg_pred_total`, running at 0.4936 of it (sd
0.039, corr +0.384). A substantial part of its variation is inherited from a model with no
signal. ⚠ Unlike the full-game total this was **not graded** — the local 2026 pbp cache stops at
week 3, so there is no honest 1H result set. It is suspended because its anchor is dead and it
carries no validation of its own, not because it was measured and failed. `h1_spread_pick` and
`h1_ml_pick` track `fg_pred_margin` (corr +0.870) and are left up.

## What was actually broken in the publishing path

**A second writer silently reverted the fix for sixteen days.** The HC-only guard added to
`nfl_slate_games_build.py` on 2026-10-06 was correct and merged, but
`refresh_nfl_slate_lines.py:120` did this with no tier check:

```python
rec["fg_total_pick"] = "OVER" if (float(pt) - tot) > 0 else "UNDER"
```

`render.yaml` runs the refresher immediately after the build on four separate cron services, so
the guard never survived a single invocation. Consequences on the 2026 board:

* 89 of 107 rows carried a direction; only 13 were tier `HC`.
* 24 rows carried a direction on tier `NONE`, which `predict_all` cannot emit (`NONE` always sets
  `NEUTRAL`) — the giveaway, since 18 other `NONE` rows correctly read `NEUTRAL`.
* `fg_total_edge` matched the close on 64 rows, the open on 38 and **neither on 5**, because the
  refresher recomputed the edge against whatever line it had just pulled while the tier stayed
  computed against the open. Two games were tiered `HC` on an edge of 7.94, outside HC's own 3–7
  band.

Twelve lines above it the *spread* branch does this correctly and documents why ("The build
decides WHETHER there is a lean … A NEUTRAL header stays NEUTRAL"). The totals branch was simply
never given the same guard.

Published totals record while this was live: **28-47 (37.3%) at the close, ROI −28.7%.** By tier:
`LEAN_EARLY` 8-20, `NONE` 7-13, `WEAK` 8-6, `HC` 4-5, `LEAN` 1-2, `EXTREME` 0-1. The documented
bet (HC) is n=9 all season and proves nothing either way; the loss came almost entirely from
tiers the model says never to bet.

## Fixes in this change

1. `refresh_nfl_slate_lines.py` — totals branch now mirrors the spread guard: re-tail the number,
   never create a lean, require tier `HC`, and drop to `NEUTRAL` when the live edge leaves the
   validated 3–7 band. `fg_total_pick`/`fg_total_tier` added to the row `select` — without them
   `g.get()` returns `None`, the guard reads "not HC" and NEUTRALs every pick including good ones.
2. `nfl_slate_games_build.py` — `TOTALS_PICK_ENABLED = False` suspends `fg_total_pick`,
   `tt_home_pick`, `tt_away_pick` and `h1_total_pick` together, since all four trace to the same
   dead model. One constant to flip back.

Dry-run of the new guard against all 107 board rows: 89 directional picks → 4, every survivor
tier `HC` and inside the band. With `TOTALS_PICK_ENABLED = False` it is 0.

## Still open

### Spread refit, 2026-10-23 — DONE. Verdict: cannot call it, and the docs overstate robustness

Walk-forward, fresh fit per fold. The estimator/params/seed/fold rule were replicated inline
rather than by calling `train_predict`, because passing `--train` overwrites the production
`sides_models_*.pkl`. Graded at the OPENER, the line `generate()` logs picks at. Oracle 736-0.
⚠ Required two data rebuilds first: a stale `matchup.parquet` gave 2026 only weeks 2-4, and a
stale `team_week_seasonal.parquet` put the true-s2d nets at **52% coverage** on 2026 — a 40%
result on half-missing features is a local artifact, not a verdict. Re-run at 100% coverage
(`refresh_pbp_current.py 2026` + `build_team_week_seasonal.py`) moved it only 40.5% → 38.2%.

```
conf      2023            2024            2025            2026          ALL 22-25
>=0.03    89-91  49.4%    114-80 58.8%    97-77  55.7%    13-21 38.2%   300-248 54.7%
>=0.06    76-71  51.7%     88-59 59.9%    71-54  56.8%    10-16 38.5%   235-184 56.1%
>=0.10    52-54  49.1%     59-45 56.7%    52-36  59.1%     7-11 38.9%   163-135 54.7%
>=0.15    31-32  49.2%     28-26 51.9%    33-22  60.0%      4-3 57.1%    92-80  53.5%
```

**The historical validation is REAL** — 56.1% at conf .06 over 2023-25 reproduces and beats the
55.4% in the harness comment. Unlike the totals 57%, this is not an artifact.

**Is 2026 rot or variance? Not decidable at n=34.** Binomial on conf>=0.03 (13-21):

```
vs the model's own 54.7%   P(<=obs) = 0.040   significant
vs break-even 52.4%        P(<=obs) = 0.069   not significant
vs a coin flip 50.0%       P(<=obs) = 0.115   not significant
```

So 2026 is ~2sd below the model's historical rate but **not significantly below a coin flip**,
and nothing is significant at conf>=0.06 or above. One season at 26-34 bets cannot separate a
broken model from a bad run — and the band was chosen after seeing it was bad, so even the 0.040
is optimistic.

⚠ **Two corrections to the claim in the harness comment**, both of which make the edge look less
robust than documented:
* "2022-25, 4/4 folds up" cannot have been graded at a true opener. `odds_consensus` has **no NFL
  openers before 2023** (2023: 284/285, 2024: 286/286, 2025: 281/282; 2022 absent), so that fold
  used the `open_spread.fillna(home_spread)` fallback at `forecast_harness.py:416`. On real
  openers it is 3 folds, not 4.
* **2023 is already break-even** (51.7% at conf .06, 49.1% at .10). So 2 of the 4 measurable
  seasons sit at or below break-even. The edge is carried by 2024 and 2025.

**Recommendation: leave it live, de-weight it, and pre-register the kill rule now** rather than
re-litigating it on feel in three weeks. Suggested rule: re-grade at the end of week 12 (~55-60
bets at conf .03); **suspend if the season is still under 45%**. Pre-committing the threshold is
the point — `nba-blind-sweep-fails` is what happens when a decision gets made after looking.
The frozen production model (`sides_models_2026.pkl`, Sep 18, trained on <2026) tracks this refit:
the live published record in weeks 4+ is 3-7-1, against the refit's 38%, so the refit is
representative of what shipped.

* **Nothing else is open on the spread.**
* **The totals rebuild.** `build_team_week_seasonal.py` produces true season-to-date but only 7
  CORE stats, covering 6 of the 10 feature families b15 needs. Missing: `off_pace`,
  `off_explosive_pass_rate`, `off_td_per_drive`, `off_no_huddle_rate` — all computable from pbp.
  Then rewire `consensus_totals.py` (it reads `matchup.parquet` directly and does not honour the
  `TEAM_WEEK` switch), refit, and require it to clear the market on MAE and sign agreement before
  `TOTALS_PICK_ENABLED` goes back to `True`.
* **The claimed 57-58% totals backtest is unreproducible** and should not be quoted. See
  [[nfl-totals-model-defects]]; `data/totals_b15_2025.pkl` will not load under this numpy
  (`PCG64 is not a known BitGenerator`). Given the feature finding, it was most likely an
  artifact.
* The legacy model (`nfl_predictions_epa`) was **not touched** — owner instruction is that it runs
  exactly as it did last season.
