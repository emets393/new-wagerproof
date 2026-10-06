# NFL model + pipeline audit ledger

Every defect found in the 2026-10-05/06 audit, with status. **Nothing gets closed here without a
measurement.** Added because issues were being found, reported, and then abandoned one by one.

Verified-correct findings are recorded too, so nobody re-investigates them.

## Status summary

| # | issue | severity | status |
|---|---|---|---|
| 1 | Weeks 1-3 bet at 50.0% (model never trained on them) | **real edge loss** | ✅ FIXED |
| 2 | ~~Drift guard passes vacuously on empty serve frame~~ | — | ❌ NOT A DEFECT |
| 3 | Monday-night game dropped from `nfl_training_data` every week | data loss | 🟡 DIAGNOSED, fix blocked |
| 4 | 2026 week 1 missing from 3 pregame team-week tables | data loss | 🟡 GUARDED, re-run needed |
| 5 | `nfl_training_data_epa` archiver behind (31 vs 60 rows) | data lag | 🟡 GUARDED, re-run needed |
| 6 | `net_rz_td_rate_s2d` 100% NULL on all 2,265 rows | dead feature | ⬜ OPEN |
| 7 | `h_third_road` constant 0 on all rows (logically impossible) | dead feature | ⬜ OPEN |
| 8 | The "opener" had no lookback bound | small, real | ✅ FIXED (severity overstated) |
| 9 | `nfl_team_stats` keeps no rating snapshot history | unrecoverable gaps | ⬜ OPEN |
| 10 | `last5_pr`/`consistency_pr` NULL for 2026 wks 1-3 | data loss (permanent) | ⬜ OPEN |
| 11 | `nfl_player_game_logs` has ZERO rows for 2023 | data loss | ⬜ OPEN |
| 12 | Scraper falls back from "Rating" to "Rank" with no assertion | latent | ⬜ OPEN |
| 13 | `\|\| true` on the Render epa-archive step hides failures | latent | ✅ FIXED |
| 14 | 4 stale wk1 slate rows escaped the clf/reg veto (all lost) | cosmetic/record | ⬜ OPEN |
| 15 | Stale `Oakland` row in `nfl_team_stats` (33 teams) | cosmetic | ⬜ OPEN |
| 16 | **TOTALS: slate published 58 of 61 picks on DISPLAY-ONLY tiers** | **real edge loss** | ✅ FIXED |
| 17 | **TOTALS: edge-to-outcome INVERTED on 2026 (corr −0.285)** | **unvalidated model** | ⬜ OPEN |
| 18 | `scheme_plays.parquet` stale — no 2026 rows | degraded features | ⬜ OPEN |

## ✅ Fixed

**1. Weeks 1-3 published with zero edge.** `forecast_harness.train_predict` trains on `week >= 4`
but predicts every week, so weeks 1-3 are scored by a model that never saw an early-season game.
Walk-forward 2021-25: **97-97, 50.0%, ROI −4.5% on 194 bets** (~17% of volume), no positive
season. Fix: `MIN_PLAY_WEEK = 4` in `nfl_slate_games_build.py` forces `conv = "none"` for weeks
1-3, so the card shows a number and no play. Full season goes 51.9% → 52.3%.
⛔ Do NOT instead train on weeks 1-3: measured, that takes wks1-3 to 48.4% AND wks4+ from 52.3% to
49.7%. Scoped to the SPREAD side — the totals model is a separate fit, untested for this.


## ✅ Fixed (continued)

**13 + the silent-partial-write class.** Nothing asserted that a weekly writer produced rows, so
gaps sat for five weeks with every cron green: 2026 wk1 had **0 of 32** in adv/ngs/ftn (those jobs
wrote nothing and exited 0) while injuries had 32; wk4 injuries was 27 of 32 and the epa archiver
wrote **1 of 15**. `|| true` on the archive step hid the last one outright — and that archiver is
the ONLY thing that INSERTs epa rows, because `sync_training_to_training_epa()` only UPDATEs rows
that already exist (`where e.unique_id = NEW.unique_id`).
Fix: `cfb_automation/scripts/cfb/verify_nfl_week_coverage.py`, wired into both Thursday crons and
scoped per cron (epa at 13:00, pregame upserts at 13:10, so neither can assert the other's tables).
`|| true` removed.

⚠ FOUR CALIBRATION LESSONS, each of which false-alarmed before it was right:
  * **Games per week is NOT 16** — 32 minus byes. 2026 wk5 = 15 games, wks 6-8 = 14. Read the
    schedule, never hardcode.
  * **`nfl_pregame_injuries_team_week` does NOT carry 32 teams.** Injury reports are per GAME, so a
    bye team has no row. Expecting 32 flagged **17 healthy historical weeks** whose counts are
    exactly the teams not on bye. The pbp tables (adv/ngs/ftn) DO carry all 32.
  * **An unplayed week legitimately has 0 training/epa rows** (they fill at kickoff), so those
    checks must be non-fatal until the week completes — otherwise every Thursday run fails.
  * **Short by exactly one on `nfl_training_data` is the known last-game race** — permanently lost,
    not fixable by re-running, so it WARNs instead of painting every week red.

★ **The clean sweep is the real headline: across 36 full weeks of 2024-2025 there is exactly ONE
genuine gap (2024 wk1 injuries 31/32). The training history is essentially complete.** The missing
data is confined to 2026. Re-running the 2026 wk1 pregame upserts and the epa archiver is safe and
reproducible (pbp is immutable) — unlike #3/#9/#10, which cannot be reconstructed.

## 🟡 Diagnosed, fix written, BLOCKED on permission

**3. The last game of every week is never snapshotted — a one-second race.**

ROOT CAUSE. `nfl_training_data` is written by pg_cron `nfl_training_kickoff_snapshot_every_min`
calling `fn_upsert_nfl_training_kickoff()`, which selects from `nfl_input_values_view`
WHERE `kickoff_tstz <= now()`. That view's `active_week` CTE is *the week of the next FUTURE
kickoff* (`kickoff_et_ts >= now() ORDER BY kickoff_et_ts LIMIT 1`). For the LAST game of a week
the row becomes snapshot-eligible at the same instant the view stops showing it — a **~1 second
window against a 60-second cron**. Every other game has later kickoffs in its own week keeping it
visible for hours, which is exactly why ONLY last-games are lost.

EVIDENCE: last-game-of-week missing 2024 **0 of 18**, 2025 **1 of 18**, 2026 **4 of 4**; games
that are NOT the last of their week missing: **0 in every season**. The 2026 losses are wk1
DEN@KC, wk2 NYG@LA, wk3 PHI@CHI, wk4 ATL@NO — all Monday 20:15.

FIX (half applied):
  * ✅ DONE — `public.nfl_input_values_all_weeks` created in prod 2026-10-06: the same view with
    its `active_week` join removed. Verified: 364 rows, exposes 2026 wk4 with all 16 games.
    Nothing else reads it, so creating it is inert.
  * ⛔ BLOCKED — replacing `fn_upsert_nfl_training_kickoff()` to read that view with
    `kickoff_tstz between now() - interval '2 hours' and now()`. Denied by the permission
    classifier as a shared-resource change (a live pg_cron function — a fair gate). Two lines
    change; every column and cast stays byte-identical:
        from public.nfl_input_values_view iv   ->   from public.nfl_input_values_all_weeks iv
        where kickoff_tstz <= now()            ->   where kickoff_tstz <= now()
                                                      and kickoff_tstz >= now() - interval '2 hours'
    Dry-run confirmed it would insert **0 rows right now**, which is correct.

⛔ DO NOT BACKFILL THE 4 LOST GAMES. The view derives pregame features from CURRENT team state, so
inserting them today stamps post-game values onto a pregame row — the same look-ahead trap as the
power-rating snapshot gap (#9/#10). They are permanently lost. The 2-hour bound exists for this
reason and must stay short.

## ✅ #8 — fixed, and my severity call was wrong

I opened this as "`fg_spread_edge` reconciles to no published line", escalated it to the worst
finding in the audit, and the measurement did not support that. Both halves are recorded.

**THE DEFECT (real).** `build_odds.py` filtered only `pre = oh[oh.snap_ts < oh.commence_time]`,
then took each book's earliest snapshot EVER. Books post season-long lookahead lines in July and
our capture starts 2026-07-26, so a game far from kickoff got a preseason futures number as its
"opener" — and that value drives `reg_edge`, `REG_CAP`, the price printed on every published pick,
`spread_move`, and the grading basis (`GRADE_LINE = {"fg_harness": "open"}`).

**⚠ WHERE I WAS WRONG.** I led with "average 78.7 days before kickoff". That average was dominated
by games still MONTHS out that only had July snapshots. Per season, on games that actually
approached kickoff, the unbounded opener was **already a weekly number** — mean age 6.6d (2023),
8.6d (2024), 8.2d (2025), 17.5d (2026). Bounding moves the line by a mean of **0.02 / 0.04 / 0.04 /
0.14 points**; 1.8% of games move >= 1pt; **no game in any season moves 3+**. The locked
opener-graded record is NOT materially inflated by this and it does not explain a marginal model.

**THE FIX (applied).** `OPEN_MAX_DAYS = 11` bounds the filter; a new `open_days_out` column
publishes the opener's age so nobody has to trust it blindly again. 11 was measured, not guessed:
snapshot volume holds through day 11 (10,091 snaps / 777 games) and collapses at day 12 (3,163 /
205). Verified after: 2023/24/25 keep ALL games (285/286/282); 193 dropped, **every one still in
the future**; the CLOSE is untouched (mean delta 0.005); the current week keeps all 15 games.
⚠ Because capture is continuous the earliest in-window snap sits at the boundary, so the opener is
now effectively **"the consensus line 11 days out"** — a fixed-horizon policy symmetric with the
owner's T-60 close rule, not "the first line ever posted". `OPEN_MAX_DAYS` is the knob; 7 would
mean "the week's board as it posts".

**STILL OPEN, same area:** `fg_spread_edge` / `fg_pred_margin` are in `_VERDICT_COLS` and pinned at
kickoff while `fg_spread_open`/`_close` keep refreshing, so a frozen edge sits beside live line
columns and must drift. Basis flip on moved lines: wks 1-3 open 11/12, 13/14, 13/14; wks 4-5 close
10/12, 12/12. Fix by pinning the line columns with the verdict, or recomputing from the pinned pair.

## ✅ #16 — the totals board was 95% picks the model says not to bet

Every earlier pass in this audit was on the SIDES model. The totals model claims the BIGGER edge
(~57-58% / +8-10%) and had never been checked.

`consensus_totals.py` is explicit: `HC` is "THE BET" (both sub-models agree AND
`3 <= min|edge| <= 7`); `EXTREME` (>7, "model overconfident", historically ~50%), `LEAN`, `WEAK`
and `LEAN_EARLY` (b55-only, weeks 1-3) are **display only**. The slate emitted
`fg_total_pick=r.direction` for ALL of them. Graded at the OPEN, which is the line this signal bets:

| tier | contract | n | record | hit |
|---|---|---|---|---|
| HC | **the bet** | 3 | 1-2 | 33.3% |
| LEAN_EARLY | display only | 27 | 8-19 | 29.6% |
| WEAK | display only | 8 | 2-6 | 25.0% |
| LEAN | display only | 1 | 0-1 | — |
| NONE | **no direction at all** | 6 | 1-5 | 16.7% |
| **all published** | | **45** | **12-33** | **26.7%** (ROI −49.1%) |

The model's own ledger had **4 rows all season**. The slate was showing 61.
Fix: `fg_total_pick` emits a direction only for `tier == "HC"`, mirroring `fg_spread_pick`.
Removes 43 losing-tier picks. ⚠ This does NOT establish that HC works — n=3.

## ⬜ #17 — the totals model's edge is INVERTED on 2026, and the claimed 57% is unreproducible

64 graded games: `corr(pred_total - close, actual - close) = **-0.285**` (t≈-2.3, p≈0.02), sign
agreement 35.9%, and monotone the wrong way:

| pred − close | n | actual − close | went OVER |
|---|---|---|---|
| ≤ −6 | 7 | **+8.36** | **85.7%** |
| −6..−3 | 5 | +6.10 | 80.0% |
| −3..0 | 15 | +4.80 | 53.3% |
| 0..+3 | 14 | −3.14 | 35.7% |
| +3..+6 | 13 | −1.12 | 46.2% |
| ≥ +6 | 10 | −2.20 | 30.0% |

Mean calibration is FINE (pred 46.08, actual 46.22, close 44.96) and MAE is only modestly worse
than the market (12.86 vs 10.80) — it is the DIRECTION that is backwards. Fading it = 33-13.
⚠ The claimed 57-58% came from a 2024+2025 strict-open backtest (n=172) that **cannot be
reproduced here**: `data/totals_b15_2025.pkl` fails with `PCG64 is not a known BitGenerator`.
**Treat the totals product as unvalidated and do not quote 57% until that is resolved.**

## ⬜ #18 — `scheme_plays.parquet` is stale (mtime 2026-09-01, seasons 2023-2025, no 2026)

`consensus_totals.py` says to refresh it weekly via `b46_pull_scheme.py`. It has not been touched
since before the season. ⚠ NOT the cause of #17: the code already falls back to plain pbp and
prints a loud b50 coverage line — measured null rates 21-24% on five scheme features, 0% on three,
and the >50pp drift guard did not fire. Worth refreshing; not the smoking gun.

## ⬜ Open — with the evidence needed to fix each

**6 + 7. Two dead features.** `net_rz_td_rate_s2d` has never held a value (its upstream column is
dropped by `build_matchup.py` as "broken/empty" but the derived net stayed in the list).
`h_third_road` is 0 on all 2,265 rows because a home team cannot be on a road trip (the away twin
fires 49 times). **Cost measured: ZERO** — removing both gives a byte-identical 518-465, because a
GBM cannot split on an all-null or constant column. So this is hygiene, not performance. Removing
them from `BASE` requires a `--train` refit because the frozen pickle stores its own feature list.

**8. `fg_spread_edge` matches no published line.** On the 64 rows where the line moved, edge =
`pred_margin + fg_spread_open` on 59%, `+ fg_spread_close` on 16%, and **neither on wks 4-5**
(12/16 and 7/15). The generator reruns daily and the stored edge is pinned to the line at write
time while the open/close columns say something else. Stored values are also signed (min −8.10)
while the card code writes `abs(re_mag)`. Conviction tiers key off this field.

**9 + 10. No rating snapshot history.** `nfl_team_stats` writes `on_conflict="season_year,team"`
after truncating the season — one row per team per season, `as_of_date` not in the key. A missed
week's point-in-time rating is **permanently lost**, and back-filling stamps today's rating on an
old game (look-ahead). Hence 10 is unrecoverable: leave `last5_pr`/`consistency_pr` NULL for wks
1-3 rather than fabricate them. Fix 9 by re-keying to `(season_year, team, as_of_date)`.

## ❌ Claimed as a defect, then withdrawn

**2. The drift guard does NOT pass vacuously — I misread it.** `feature_drift_guard.py:195` sets
`drift = True` on an empty serve frame and `main()` returns 1; verified empirically, `nfl --season
2026 --week 6` exits **1**. The code even carries a comment saying a vacuous pass "is worse than no
guard at all". I saw the ⛔ message, judged it "pass-shaped" without checking the exit code, and
listed it in this ledger as FIXED before verifying the problem existed. No code was changed.

## ✅ Verified correct — do not re-investigate

* **Power ratings are exact.** 32/32 teams match TeamRankings live, abs diff **0.000**, on both
  predictive and last-5. Source: a TeamRankings scrape, not our own computation.
* **Offensive EPA s2d definition and scale are intact.** Canary `off_plays_seen` climbs
  monotonically 6,555 (2024 wk2) → 8,857 (2026 wk4) with no reset; `off_pass_epa_neutral_s2d`
  holds 0.0559-0.0580 across 2024/2025/2026. The cumulative-since-2018 defect is FIXED.
* **No look-ahead in `_s2d`.** Built from games where `season < S` OR (`season == S` AND
  `week < W`), enforced before aggregation.
* **No second feature pipeline.** `nfl_slate_games_build.py:364` imports the same
  `forecast_harness.build()`. The frames cannot diverge.
* **Nulls are not why the model loses.** Simulating the 2026 null condition (65% null on
  `last5_diff` + both `consistency_pr`) on the training window costs **0.2 points** of hit rate.
* **The clf/reg two-head disagreement is already vetoed** in the generator; the 4 rows that ever
  escaped went 0-4.
* **15 games in a week is normal** when 2 teams are on bye (wks 6-8 2026 have 4 byes = 14 games).
* **The drift guard fails loudly on an empty serve frame** (exit 1). See the withdrawn item above.

## The honest bottom line

With production hyperparameters (`max_depth=3, max_iter=300, min_samples_leaf=40`) the sides model
is **52.3% against the close, ROI −0.1%**, versus a 52.38% break-even. By season: 52.3 / 52.7 /
47.5 / 53.5 / 57.7. Fixing every item above is worth well under a point. **The model is marginal,
not broken, and no data fix found so far changes that.** Earlier figures in this audit quoting
52.7% / +0.6% used library-default hyperparameters and were 0.4 points optimistic.
