# NFL Week 12 2025 Dry Run — App Data Contract

**What this is**: a full simulation of what the app shows users for one NFL week,
built exactly the way the 2026 season pipeline will build it. We pretend it's
Wednesday of Week 12, 2025: every model is trained only on data available before
2025 (walk-forward), every signal is computed point-in-time (no look-ahead), and
every line is the real consensus close from our snapshot history.

**Where it lives**: three staging tables on the research Supabase project
(`jpxnjuwglavsjbgbasnl`), public-read, queryable exactly like the in-season tables
will be:

| Table | Rows | One row per |
|---|---|---|
| `nfl_dryrun_games` | 14 | game — every prediction the app displays |
| `nfl_dryrun_flags` | 51 | fired bet signal (the badge layer) |
| `nfl_dryrun_props` | 942 | (player, market) — line + trends + P-flags |

**Generators**: `dryrun_wk12_games.py` (games + flags), `dryrun_wk12_props.py` (props).
Both are idempotent (delete-then-insert for season=2025, week=12).

## 0. How to connect

All three tables are public-read (RLS allows anon select). Use the standard
Supabase JS client or plain REST — same patterns as the production app.

```
URL:      https://jpxnjuwglavsjbgbasnl.supabase.co
anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo
```

Example queries:

```js
const sb = createClient(URL, ANON_KEY);

// all game cards for the slate
await sb.from('nfl_dryrun_games').select('*').order('gameday');

// active bet signals (the picks the app surfaces)
await sb.from('nfl_dryrun_flags').select('*').eq('tier', 'active');

// props for one game, flagged players first
await sb.from('nfl_dryrun_props').select('*')
  .eq('game_id', '2025_12_BUF_HOU')
  .order('flags', { ascending: false, nullsFirst: false });
```

Join key across all three tables: `game_id` (e.g. `2025_12_BUF_HOU`).

---

## 1. `nfl_dryrun_games` — game cards

Key: `game_id` (nflverse id, e.g. `2025_12_BUF_HOU`). Meta: `season, week, gameday,
slot` (thu_fri / sun_early / sun_late_sat / snf / monday), `home_ab/away_ab`,
`home_team/away_team` (display names).

### Market lines (consensus = median line + median price across books)
| Columns | Source |
|---|---|
| `fg_spread_open/close`, `fg_total_open/close`, `fg_ml_home/away_close` | `odds_consensus.parquet` (American odds) |
| `tt_home/away_close` + over/under prices | team-total close snapshot (`h1tt_frame`) |
| `h1_spread_close` + side prices, `h1_total_close` + o/u prices, `h1_ml_home/away_close` | 1H close snapshots |

All prices stored as American odds. Spreads are home-relative (negative = home favored).

### Model predictions (every game gets a number — this IS the product)
| Column | Meaning | Render |
|---|---|---|
| `fg_pred_total` | LOCKED consensus-totals ensemble (b15+b55, strict-open) | the game-total number on the card |
| `fg_total_edge` | pred − open total | drives tier |
| `fg_total_pick` / `fg_total_tier` | OVER/UNDER/NEUTRAL; HC / LEAN / WEAK / EXTREME / NONE | **HC = bet-quality badge** (3≤edge≤7); LEAN/WEAK = lean text only; EXTREME = show number, suppress confidence |
| `fg_home_cover_prob` | LOCKED sides harness P(home covers) | spread confidence % |
| `fg_spread_pick` | side at the opener, or NEUTRAL when \|p−.5\|<.03 | spread pick chip |
| `fg_spread_confluence` | 1 = classification + regression models agree (b70) | confidence indicator, never show the raw reg number |
| `fg_pred_margin` | regression home margin | internal; feeds win prob + TTs |
| `fg_home_win_prob` | Φ(pred_margin / 13.86) | moneyline probability dial |
| `tt_home_pred` / `tt_away_pred` | (pred_total ± pred_margin)/2 | **DISPLAY ONLY** — team totals are never a model bet tier (vaulted decision); TT bets come only from K-signal flags |
| `h1_pred_total`, `h1_pred_margin`, `h1_home_win_prob` | anchored 1H GBM (LOCKED_MODELS §8), trained 2023-24 | 1H card numbers — every game |
| `h1_total_edge` (`e_tot`), `h1_cover_tilt` (`e_cov`) | 1H residual edges | internal confluence inputs for M-flags; not user-facing numbers |

### Summary + validation
`flags_active`, `flags_tracking` (counts), `mammoth` (any 3-unit flag).
`final_home/away`, `h1_home/away` = actual scores — **validation only, never shown pregame**.

---

## 2. `nfl_dryrun_flags` — the bet-signal layer

One row per fired rule. `tier='active'` = validated bet flags the app surfaces as
picks; `tier='tracking'` = paper-trade 2026 (show in a "watch" section or hide).

| `source` | Rules | Tier |
|---|---|---|
| `fg_harness` | the 20 LOCKED FG spot rules (sides_model, legacy_fade/primetime, tight_soft_ml_fade_home, dk_giant_fav_over, dk_heavy_home_juice, receiver_over, wind_under, trap fades, …) | active, except primetime_tight_favorite / primetime_tight_under / bot_vs_bot_under / bye_collision / week1_def_under → tracking |
| `consensus_totals` | `consensus_totals_HC` (the 3-7 edge sweet spot) | active |
| `h1_model` | `M1_window_over_k1`, `M2_k1_model_lean`, `M3_primetime_fav_tilt`, `M4_slow_start_dog_fade` (vault §8) | tracking (paper-track 2026) |
| `k_signal` | `K1_tt_sum_q5_over`, `K2_bigfav_home_tt_over`, `K3_h1_steam_follow_small`, `K5_tt_cut_bounceback_over`, `K6_tt_raise_momentum_over`, `K7_slow_start_dog_fade_1h`, `K8_primetime_1h_fav` (H1TT_BRIEF1 keepers; **K4 omitted** — needs live offshore polling) | tracking |
| `props` | `P11_atd_implied_over` (vaulted; ATD-implied total top slate quintile, mapping fit on 2024 only) | active |

Fields: `market` (spread/total/team_total/h1_spread/h1_total), `side` (display
string, e.g. "BAL TT OVER 29.5"), `line`, `price` (American at the bet line; null =
consensus ~-110), `edge` (rule-specific magnitude), `mammoth`.

Grading rule embedded in the data: **the line on the flag row is the line the
signal was computed from** — open-signals carry the open line, close-signals the
close. Grade against that line, never a different snapshot.

Week 12 output: 51 flags (25 active / 26 tracking) across 14 games.

---

## 3. `nfl_dryrun_props` — player prop cards

One row per (player, market); 942 rows, 387 players, all 6 markets:
`player_pass_yds`, `player_pass_tds`, `player_rush_yds`, `player_receptions`,
`player_reception_yds`, `player_anytime_td`. Offense positions only (QB/RB/WR/TE/FB
— no defensive/ST TD props, ever).

| Group | Columns | Notes |
|---|---|---|
| Identity | `player_id` (gsis), `player_name`, `position`, `team`, `opponent`, `is_home`, `game_id`, `headshot_url` | headshot denormalized from `nfl_player_profiles` (join key `gsis_id`); 100% coverage this slate |
| Line | `close_line`, `over_price`, `under_price`, `open_line`, `line_delta`, `line_range` (cross-book close spread), `n_books` | consensus = median across DK/FD/MGM/Caesars. ATD: `close_line` null, `over_price` = YES price, `close_yes_prob`/`open_yes_prob` = implied |
| Trends (point-in-time, weeks 1-11 only) | `gp_prior`, `last_game`, `l3_avg`, `l5_avg`, `l10_avg`, `szn_avg`, `szn_max`, `szn_min`, `over_rate_l5`, `over_rate_l10`, `recent_games` | over-rates = share of recent actuals beating the **current** close line; `recent_games` = jsonb `[{week, opp, actual}]` for the sparkline |
| Matchup | `def_allowed_pos`, `lg_allowed_pos`, `def_matchup_idx` | opponent position-allowed vs league (<1 = tough) |
| Injury | `report_status`, `practice_status` | Questionable players play ~80% — show, don't hide |
| Flags | `flags` text[] | P-flags fired (below) |

### P-flags (PROPS_BRIEF1, validated 2024+2025)
| Flag | Trigger (all point-in-time) | Bet direction | Wk12 fires |
|---|---|---|---|
| P1 | QB pass yds line >5% above L5 avg (gp≥4) | OVER | 7 |
| P2 | pass yds line 5-20% below L5 avg | UNDER | 6 |
| P3 | pass TDs line ≥40% above L5 avg | OVER | 4 |
| P4 | QB with 0 prior games this season | UNDER | 4 |
| P5 | ATD yes-prob fell ≥5pts open→close | YES | 12 |
| P6 | ATD yes-prob rose ≥5pts | **NEVER BET** (anti-flag) | 6 |
| P7 | rush yds vs run D allowing <0.8× league (wk≥5) | UNDER | 18 |
| P8 | rush yds line spread ≥3 across books | UNDER at highest book | 18 |
| P9 | QB under pass-TD line 2 straight prop-weeks | OVER | 10 |
| P10 | receptions line raised 2 straight prop-weeks | UNDER | 7 |

P11 is game-level → `nfl_dryrun_flags`.

---

## 4. What the app screens map to

- **Games tab / game card**: `nfl_dryrun_games` — FG spread pick + cover %, ML win
  prob, total pick + tier, both team totals, full 1H strip (spread/ML/total
  predictions). Every game has every number.
- **Bet signals / value finds**: `nfl_dryrun_flags` where tier='active'
  (mammoth=true → 3-unit styling). Tracking tier optionally as "watching".
- **Player props tab**: `nfl_dryrun_props` filtered by game or market — headshot,
  consensus line/prices, L5/L10 trend bars + sparkline from `recent_games`,
  matchup index, flag badges.
- **Matchup page**: join all three on `game_id`.

## 5. Known gaps before Week 1 2026 (deferred, see LOCKED_MODELS §8)

1. Live odds collector must add `spreads_h1, totals_h1, h2h_h1, team_totals`
   markets (currently backfill-only).
2. K4 (offshore stale chase) needs offshore board polling — excluded here.
3. Weather not joined in the dry run (wind_under fired from historical data in the
   harness; live pipeline already captures weather).
4. `fg_home_win_prob` uses the Φ(margin/13.86) conversion — no dedicated ML model;
   revisit if we want calibrated moneyline probabilities.
