# Systems — Live RPC filter keys (NFL + CFB)

The `p_filters` contract after the as-of aggregation went live (2026-07-18). These are the keys the
`nfl_analysis` / `cfb_analysis` RPCs on `jpxnjuwglavsjbgbasnl` now accept. Existing keys (season, week,
side, spread, ml, total, fav_dog, primetime, conference, weather, last_* toggles, team[], opponent[]) are
in `15_mobile_historical_analysis.md`. Everything below is NEW and backed by verified, leak-safe columns.

Applies to NFL + CFB. MLB / NBA / NCAAB not yet built. As-of features are game/team-level, so they apply
across bet types (they describe the *situation*, not the market).

## New range filters (send `<key>_min` and/or `<key>_max`, numeric; either side optional)

| Key | Meaning (team's season-to-date, at the time of the game) |
|---|---|
| `win_pct` | win % (0–1) |
| `ats_win_pct` | ATS cover % (0–1) |
| `over_pct` | over % (0–1) |
| `win_streak` / `loss_streak` | current win / loss streak (games) |
| `ats_win_streak` | current ATS cover streak |
| `over_streak` / `under_streak` | current over / under streak |
| `avg_cover_margin` | average cover margin (points) |
| `ppg` / `pa_pg` / `point_diff_pg` | points per game / allowed per game / differential |
| `prev_wins` / `prev_win_pct` | last season's wins / win % |
| `opp_win_pct`, `opp_ats_win_pct`, `opp_over_pct`, `opp_win_streak`, `opp_prev_win_pct` | opponent equivalents |
| `min_games` | guard: only games where the team already had ≥ N games this season |

## New boolean filters (send `true` / `false`)

| Key | Meaning |
|---|---|
| `above_500` | team's win % > .500 |
| `made_playoffs_prev` / `opp_made_playoffs_prev` | team / opponent made the postseason last year |
| `win_pct_gt_opp` | team's win % > opponent's |
| `more_wins_than_opp_prev` | team had more wins than opponent last season |
| `h2h_last_home` / `h2h_last_fav` | last meeting: team was home / favorite |
| `h2h_same_season` | last meeting was this same season |
| `h2h_spread_lower` / `h2h_spread_higher` | team's spread is lower / higher than in the last meeting |

## New tri-state (1 = yes, 0 = no) filters

| Key | Meaning |
|---|---|
| `h2h_last_win` | team won the last meeting |
| `h2h_last_ats_win` | team covered in the last meeting |
| `h2h_last_over` | last meeting went over |
| `opp_last_won` | opponent won their last game |
| `opp_last_covered` | opponent covered in their last game |
| `opp_last_over` | opponent's last game went over |

## Opponent last-game mirror (added 2026-07-19)

Full mirror of the subject "Last game" filters, computed from the opponent's own `last_*` via self-join
(`opp_last_fg_won`, `opp_last_fg_covered`, `opp_last_ou_result`, `opp_last_is_favorite`,
`opp_last_overtime`, `opp_last_margin`). Snapshot dims `oppLastResult/Ats/Total/Role/Ot/Blowout`.

| Key | Type | Meaning |
|---|---|---|
| `opp_last_favorite` | bool | opponent was the favorite in their last game |
| `opp_last_overtime` | bool | opponent's last game went to overtime |

**Last-game MARGIN (added 2026-07-19, replaced the ±21 blowout filter):** signed point margin of the
previous game — positive = won by, negative = lost by. Range keys (equal = [X,X], `<` = [floor,X],
`>` = [X,ceil], between = [A,B]):
- `last_margin_min` / `last_margin_max` (subject; column `last_margin`, bounds ±60)
- `opp_last_margin_min` / `opp_last_margin_max` (opponent; column `opp_last_margin`)
The `last_blowout` / `opp_last_blowout` keys are **removed** (NFL). Snapshot dims `lastMargin` /
`oppLastMargin` (numRange). CFB still uses its blowout filter.

## Build artifacts (reproducibility, working tree)
- `research/cfb-model/asof/asof_features_cfb.py` + `asof_cfb.parquet` + `asof_alter_cfb.sql`
- `research/nfl-extreme-outcomes/asof/asof_features_nfl.py` + `asof_nfl.parquet` + `asof_alter_nfl.sql`
- `research/systems_deploy/deploy_asof.py` (ALTER + merge) · `rpc_extend.py` (RPC predicates) ·
  `rpc_extended/*.sql` (the live function bodies)

## Multi-select day + division (added 2026-07-19)

- `day_of_week` — **array** of day names (`Sun`/`Mon`/`Tue`/`Wed`/`Thu`/`Fri`/`Sat`); `b.day_of_week IN (…)`.
  Changed from single-value to array (no prior UI caller). Snapshot dim `daysOfWeek` (multiselect).
- `team_division` — **array** of divisions (`AFC East` … `NFC West`); new static column
  `nfl_analysis_base.team_division` (team→division map, fixed 2018–2025). Snapshot dim `teamDivisions`.
  Separate from the existing `division` bool (is-it-a-divisional-game). Opponent-division not yet built.


## Real price-based ROI — ALL markets (2026-07-19)

`nfl_analysis` computes per-row profit at REAL closing prices for every market. Sources:
- `fg_ml`: `team_ml` (2018+, 99.96%). Ties excluded as pushes.
- Everything else: 9 decimal-odds columns merged onto the base from `nfl_historical_odds` — the T-60
  closing snapshot per book, **median across ~8 books computed in decimal space** (American-median is
  broken by the ±100 discontinuity): `fg_spread_px`, `h1_spread_px`, `h1_ml_px`, `fg_total_over/under_px`,
  `h1_total_over/under_px`, `tt_over/under_px`. Coverage: 100% of 2023–25 for FG spread/total, ~99% for
  1H/TT (which only exist 2023+ anyway → effectively full real-price coverage for the limited markets).
- Fallback: pre-2023 spread/totals rows use flat −110 (0.909); ML rows without a price are excluded.
RPC implementation: uniform `bet_profit` (+ `under_profit` for the over/under bar) per-row columns in `_f`;
every roi site = `avg(bet_profit)`. Sanity: fg_spread −4.6%, fg_ml −4.0%, h1_ml −5.6%, fg_total over
−8.2% / under −0.9% (asymmetric = real prices). Web shows ROI for all markets now.


## CFB parity (2026-07-19)

`cfb_analysis` now also accepts: `last_margin_min/max`, `opp_last_margin_min/max`,
`opp_last_{won,covered,over}` (1/0), `opp_last_{favorite,overtime}` (bool), `day_of_week` (array —
CFB plays Tue–Sat; Sun/Mon rare). Real price ROI: fg_ml via `team_ml` (2021+), fg_spread/fg_total via
T-60 median closing px (2021+, ~95%), `h1_ml` roi = null (no 1H prices), h1/tt flat −110. New base cols:
`opp_last_*` (6), `game_date`, `day_of_week`, `fg_spread_px`, `fg_total_over/under_px`. Record:
`research/systems_deploy/cfb_parity_2026_07_19.md`.

## Not yet done
- `*_analysis_upcoming` does NOT yet expose these columns for scheduled games (so today's-matches can't be
  filtered by as-of stats yet). Deferred — see the "completed vs upcoming" note in `04_...SPEC.md`.
- MLB / NBA / NCAAB.
