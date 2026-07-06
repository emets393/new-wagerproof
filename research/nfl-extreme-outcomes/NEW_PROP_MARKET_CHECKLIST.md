# Adding a New Player-Prop Market — Full Checklist

When you add a prop market (e.g. `player_pass_attempts`), it is NOT enough to just capture the
line. A market touches **six surfaces**: live capture, historical data, the prop card + its
graphs, grading, the signal layer, and the Outliers trends page. Miss one and the market shows
up half-built (line but no history graph, or a card but no Outliers trend, or fires but never
grades). This is the list. Worked example = the attempts/completions markets (2026-07-04).

## 1. Capture the line (live + historical)
- [ ] `live_props.py` → add to `MARKETS` (hourly T-60 capture for the live season).
- [ ] Historical backfill if the model/trends need past seasons: `props_backfill_extra.py`
      (fetch at existing snapshot timestamps) + `props_parse_extra.py` (roster-match + load to
      `nfl_player_props`). Parser is market-agnostic for O/U props (only ATD is special-cased).

## 2. The actual stat (for grading + trends + model)
- [ ] Confirm the actual exists in `nfl_player_game_logs`. If not, add the column + map it in
      `ingest_player_logs.py` COLMAP, and backfill (`add_completions.py` is the pattern for a
      column that existed but was unpopulated). Actuals also needed in `player_offense.parquet`
      for the research scripts.

## 3. Grading — `grade_nfl_props` RPC
- [ ] Add `WHEN 'player_xxx' THEN g.<stat>` to BOTH CASE blocks (actual_value + result).
      Missing market → silently grades as false 'push'. **Shared warehouse RPC → needs owner
      auth to apply** (see `migrations/grade_nfl_props_add_attempts_markets.sql`).

## 4. The prop card + its graphs — `dryrun_wk12_props.py` (→ live props generator)
- [ ] Emit a card row per (player, market) into `nfl_dryrun_props`. If the market isn't in
      `props_frame` (the original 6), build a parallel consensus frame from `props_rows_extra`
      (see `attempts_consensus`).
- [ ] **The season graphs** = these fields MUST be populated or the card renders empty:
      `gp_prior, last_game, l3_avg, l5_avg, l10_avg, szn_avg, szn_max, szn_min,
      over_rate_l5, over_rate_l10, recent_games` (jsonb sparkline `[{week,opp,actual}]`).
      See `attempts_form` + `attempts_def_matchup`. Non-applicable fields (injury, ATD probs) → null.

## 5. The signal layer (only if the market has a validated edge)
- [ ] Fire flags in the generator's flag step (`attempts_flags`; keys like P14/P15/P16 — the
      `_` in `signal_key LIKE 'P14_%'` disambiguates P1 from P14).
- [ ] Register in `nfl_signal_defs` via `nfl_signal_defs_load.py` (display_name, definition,
      why_it_works, bet_direction, typical_hit = all-time validated record, conviction).
- [ ] `signal_performance` (season-to-date) auto-derives via `refresh_all_signal_performance`
      once graded — nothing to hand-write, but it depends on #3 grading working.

## 6. Outliers trends page — `gen_nfl_player_prop_trends.py`
- [ ] Add the market to `PROP_MKT` (hit/loss labels) and `EXTRA_STAT` (actual column).
- [ ] If not in `props_frame`, feed it via `attempts_games()` (T-60 close + actual) concat'd in
      `build_logs`. This produces splits (dims × windows) + cross-season matchups in
      `nfl_player_prop_trends`.
- [ ] Update `CURSOR_OUTLIERS_TRENDS_PROMPT.md`: the `nfl_player_prop_trends` markets row (§1)
      AND the Players bet-type list (§6).

## 7. Docs
- [ ] `DRYRUN_WK12_SPEC.md`: row count, §3 markets list, P-flag table.
- [ ] This checklist + the relevant memory (`nfl-game-script-analysis`, `nfl-player-props-infra`).

## Quick verify (DB)
```sql
-- card + graphs present
SELECT market, count(*), count(recent_games) FROM nfl_dryrun_props
WHERE market='player_xxx' GROUP BY market;
-- outliers trend present
SELECT count(*) FROM nfl_player_prop_trends WHERE 'player_xxx'=ANY(markets);
-- grading maps (after RPC update): result should not be all 'push'
SELECT result, count(*) FROM nfl_player_props WHERE market='player_xxx' GROUP BY result;
```
