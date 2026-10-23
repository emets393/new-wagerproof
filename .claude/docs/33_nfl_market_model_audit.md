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

* **The spread model needs a refit including 2026.** It is structurally sound — the clf/reg veto
  holds (0 escapees from week 4 on; all 5 are week-1 pre-fix pinned rows) and weeks 1-3 are
  suppressed — and it carries real 4-season validation (2022-25 opener-graded 53.0% → 55.4% at
  conf .03, 4/4 folds up, placebo 52.6%). But 2026 is ugly: the classifier is **34-51 (40.0%)**
  ungated across all 93 games with no monotone dose-response (the 0.15+ confidence band is the
  *worst* at 31.2%), and published picks are 13-24-3. ⚠ Do not condemn it on this — n=85 for one
  season against four validated ones, and `model-regime-drift-law` says to sweep the half-life at
  fixed selectivity rather than pool. It needs the walk-forward re-run with 2026 included to tell
  a bad season from genuine rot. Until then it ships, loudly flagged.
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

---

## Confluence study, 2026-10-23 — ★ the sides edge is real and it is GATED

Port of the NBA mammoth search ([[nba-confluence]]) to NFL full-game markets, which had never
been run (`model_confluence.py` is props-only). ⛔ All bands pre-registered before looking;
placebo = outcome shuffled within season, 3 seeds; min reportable n=30; oracle 736-0.

### The finding

Spread, graded at the opener, model gate |ph-0.5| >= 0.06:

```
primetime ONLY (no rest edge)     52-30   63.4%   n=82     per season 62.5 / 67.6 / 68.0
rest edge ONLY (not primetime)    27-13   67.5%   n=40     per season 75.0 / 71.4 / 68.8
BOTH                              11-4    73.3%   n=15
NEITHER                          155-153  50.3%   n=308    <- a coin flip
all gated picks                  245-200  55.1%   n=445
```

The two gates select different games (overlap 15) and are **additive**. So the 55.1% headline was
a blend of a real ~64% edge on 137 picks and noise on 308 — which is why the model never felt
like it worked. Placebo bands: primetime [47.4, 57.3], rest [40.7, 54.7]; both cleared.

**The moneyline carries it further, and harder** — model side priced at the opener, ROI (not hit
rate, since a 60% hit rate on -200 favourites still loses):

```
model alone            238-217   52.3%   ROI  +1.7%     2023 -4.9%   2024 +2.4%   2025 +12.7%
GATE (prime or rest)    88-51    63.3%   ROI +21.1%     2023 +30.7%  2024 +19.5%  2025 +19.1%
NOT gated              150-166   47.5%   ROI  -6.9%
```

3/3 seasons strongly positive on the gate, negative ungated. ⚠ ML ROI is high-variance (a few
long dogs move it), so treat +21% as directional, not as a forecast. 2026 is -15.2% on a tiny n.

### Negative results, all load-bearing

* ⛔ **Naive stacking FAILS on NFL.** model + >=1 agreeing signal = 54.6%, *worse* than model
  alone (55.1%); >=2 signals 55.9%, no lift. Do NOT port NBA's ">=1 signal" rule.
* **Never fade a move.** "Line moved against the model" = 49.7%, below its own placebo.
* ⛔ **Totals confluence is null.** Model alone 48.3% at |edge|>=3 and nothing clears placebo
  consistently; the one good-looking cell (>=2 signals, 58.7%) is entirely 2023 (85.0% on n=20)
  then 51.6 / 52.5. The totals suspension stands.

### ⛔ Two traps caught inside this study

1. **The best-looking signal was look-ahead.** "Line moved toward the model" scored 58.9%
   (112-78, 3/3 seasons) graded at the opener — but the gate is computed from the CLOSE while the
   grade is at the OPEN, and you cannot know the close when betting the open. At trigger time
   (the close) it is **52.4%**, break-even. This is what [[nfl-backtest-grading-framework]] means
   by "movement -> trigger-time", and it is the same shape as the 57% totals myth.
2. **A 66.6% team-total result was a broken join.** `odds_hist.parquet` keys on city names +
   `commence_time`, NOT on (season, week, home_ab, away_ab) — only `season` matched, so every
   game in a season got one arbitrary team-total point (mean home point 27.0 vs mean home score
   23.7). The model then always picked UNDER and that fixed bias read as a 66.6% edge, with the
   gate making it *worse* — which is the tell. **Team totals remain unmeasured**; redoing it needs
   the city-name crosswalk and a chosen snapshot time.

### The weather look-ahead lead: CHECKED, and it is clean

`wind_mph` resolves to `wind_speed` (the pregame Supabase table) at 64-75% coverage per season,
with `nv_wind` (nflverse's game-time actual) only filling 0-5% of rows. The two are **not** the
same number: 1.1% identical, mean absolute difference 2.65 mph, corr +0.696. So the model trains
on a genuine pre-kickoff forecast and the sides numbers are not inflated by weather leakage.
⚠ Residual: the 0-5% `nv_wind` fallback IS the actual and is a small real leak (5% in 2025);
dropping the fallback for training rows would close it.

### Shipped in this change

`SPREAD_GATE_ENABLED = True` in `nfl_slate_games_build.py`: `fg_spread_pick` carries a side only
when the game is primetime OR the model's side has >= `SPREAD_GATE_REST_DAYS` (3) more days rest.
A new `fg_spread_gate` column records which gate passed, for display and post-hoc grading.

Gate inputs come from `matchup.parquet`, not `h1tt_context.parquet`. Two reasons: `build.py`
writes matchup at step 57 with 100% current-season coverage while the 1H frames are rebuilt later
and carried **no 2026 rows at all** when this was written (so an h1tt-sourced gate would have
failed closed on every game and blanked the spread board), and matchup is the frame the study
itself ran on, so the gate selects exactly the validated games.

`spread_gate()` **fails closed** — an unverifiable gate is not a passed gate — and `main()` prints
the gate distribution every run, flagging `held_unverifiable` loudly. That distinguishes "the feed
broke" from "the slate was quiet", which otherwise look identical on the site.

Verified on 2026 week 7: 8 of 14 games eligible on at least one side, byes resolving correctly
(CIN@BAL -> Cincinnati on 14 days vs Baltimore's 7 qualifies the away side). Historically the gate
admits 292 of 706 games (41%) at week 4+.

⚠ **Caveats that belong next to the 63-67%:** 7 signals were tested and 2 hit, so multiple
comparisons apply — what carries it is 3/3 seasons + placebo + dose-response + mutual
independence, not one p-value. `rest`-only n=40 is thin. 2026 is poor in every cell but n per
cell is 2-6, so it says nothing yet. And both gates sit inside the model's own feature set
(`primetime_i`, `home_rest`/`away_rest`), so this is conditional performance, not true
confluence: the model sees them and still cannot price them.
