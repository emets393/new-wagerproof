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
| 8 | **The "opener" is a PRESEASON line (avg 78.7 days out)** | **worst found** | 🟡 DIAGNOSED |
| 9 | `nfl_team_stats` keeps no rating snapshot history | unrecoverable gaps | ⬜ OPEN |
| 10 | `last5_pr`/`consistency_pr` NULL for 2026 wks 1-3 | data loss (permanent) | ⬜ OPEN |
| 11 | `nfl_player_game_logs` has ZERO rows for 2023 | data loss | ⬜ OPEN |
| 12 | Scraper falls back from "Rating" to "Rank" with no assertion | latent | ⬜ OPEN |
| 13 | `\|\| true` on the Render epa-archive step hides failures | latent | ✅ FIXED |
| 14 | 4 stale wk1 slate rows escaped the clf/reg veto (all lost) | cosmetic/record | ⬜ OPEN |
| 15 | Stale `Oakland` row in `nfl_team_stats` (33 teams) | cosmetic | ⬜ OPEN |

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

## 🟡 #8 — diagnosed, and it is the worst thing in this audit

I opened this as "`fg_spread_edge` reconciles to no published line". That was the symptom.

**⛔ `build_odds.py` puts NO LOOKBACK BOUND on the opener.** It filters only
`pre = oh[oh.snap_ts < oh.commence_time]`, then takes `groupby("book").snap_ts.idxmin()` — each
book's earliest snapshot EVER. NFL books post season-long lookahead lines in July and our capture
begins 2026-07-26, so for most games the "opener" is a July futures number.

MEASURED IN PROD (`nfl_historical_odds`, 2026, 326 games): **average 78.7 days before kickoff**;
53 games at 0-7 days, 107 at 45-90, **165 at 92-165 days**.

That one value drives `reg_edge`, `REG_CAP = 7.0` and the conviction ladder, the price printed on
every pick (`fg_spread_pick = f"{team} {open_spread:+g}"`), `spread_move`, and — the serious part —
**the grading basis** (`GRADE_LINE = {"fg_harness": "open", "consensus_totals": "open"}`).

**So the published record grades a week-N pick, made from week-N features, against a July line.
You could not have placed that bet, and a preseason line is much softer than a weekly opener, so
the edge reads high.** The locked opener-graded sides 53.4% / totals ~57% are suspect for this
reason.
⚠ My audit's **52.3% is UNAFFECTED** — it grades at the CLOSE. The model's capability estimate
stands; it is the PUBLISHED record that is inflated, and this is most of the gap between them.

SECOND DEFECT, same area, which is what made it visible: `fg_spread_edge` and `fg_pred_margin` are
in `_VERDICT_COLS` and **pinned at kickoff**, while `fg_spread_open`/`_close` keep refreshing. A
frozen edge beside live line columns must drift. Basis flip on moved lines: wks 1-3 open-basis
11/12, 13/14, 13/14; **wks 4-5 close-basis 10/12, 12/12**.

FIX (deliberately NOT applied — it re-rates the whole product): bound the `pre` filter to the
earliest snap within ~7-10 days of kickoff, use ONE opener definition everywhere, then re-derive
REG_CAP and the conviction ladder and re-grade the locked record. **Expect the opener-graded record
to FALL.** There is an owner policy for the close ("closing line" = T-60) and none for the opener;
that gap is what allowed this. This needs an owner decision, not a silent patch.

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
