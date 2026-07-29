# NFL / CFB Render Contract — source of truth for cards, lines, signals

> Last verified against DB + code: 2026-07-29. This is the authoritative contract for **where every
> NFL/CFB value on a game card comes from** and how it must render. Read before touching any game
> card, market card, betting line, line-movement chart, or signal. Companion to `23_NFL_CFB_2026_DATA_MAP.md`
> (table map) and `24_LINE_MOVEMENT_ARCHIVE.md` (odds archive).

All NFL/CFB data is on the **CFB Supabase project** (`jpxnjuwglavsjbgbasnl`), web client
`collegeFootballSupabase` (`src/integrations/supabase/college-football-client.ts`, env
`VITE_CFB_SUPABASE_URL`). **The Odds API is the only source of betting lines** — never CFBD/ESPN/nflverse
for odds (those are schedules/scores/ratings only).

## 1. Table names — use `*_slate_*`, not `*_dryrun_*`

The production tables were renamed off the misleading "dryrun" name (that name was leftover from the
2025 test slate). Current tables:

`nfl_slate_games` · `nfl_slate_flags` · `nfl_slate_picks` · `nfl_slate_props`
`cfb_slate_games` · `cfb_slate_flags` · `cfb_slate_picks`

The old `*_dryrun_*` names still exist as **auto-updatable compat views** over the new tables, so
un-migrated code keeps working. **Use the `*_slate_*` names in all new/edited code; never reintroduce
`dryrun`.** A repo-wide code rename is pending (compat views drop once the native apps ship on the new
names). See memory `dryrun-to-slate-rename`.

## 2. Two sources per game — they MUST agree

The single most common bug: the header and the market cards read different model sources and disagree.

| Layer | Table | Fields |
|---|---|---|
| **Game header / model summary** | `*_slate_games` | `fg_pred_home_pts`, `fg_pred_away_pts`, `fg_pred_spread`, `fg_pred_margin`, `fg_pred_total`, `tt_home_pred`, `tt_away_pred`, `fg_home_win_prob`; lines `fg_spread_open/close`, `fg_total_open/close`, `tt_*_close` |
| **Per-market cards** | `*_slate_picks` | one row per `card_group` (`spread`/`total`/`team_total`/`moneyline`[/`h1_*` in later weeks]): `model_number`, `model_line`, `vegas_line`, `edge`, `has_play`, `signal_keys`, best-book fields |

**The picks mirror the header** — the market cards' model numbers equal the header's for the same
game. If they diverge, the picks table is **stale** (regenerate it), not a rendering problem — do not
mask the mismatch in the UI. Spot-check game: UAB @ Illinois (`cfb`, `game_id=401858424`) → Illinois
42.8 / UAB 15.6, spread −27.2, total 58.4, Illinois ML 0.946; the spread card = UAB +27.2, edge 0.3.

## 3. Current line + line movement — read the views, keyed by `game_id`

| View | Columns |
|---|---|
| `nfl_line_movement` | `game_id, season, snap_ts, n_books, fg_spread_home, fg_total, h1_spread_home, h1_total, tt_home, tt_away` |
| `cfb_line_movement` | `game_id, season, snap_ts, n_books, fg_spread_home, fg_total` |

- **Current line** for a market = the row with `MAX(snap_ts)` for that `game_id`.
- **Movement chart** = all rows for the `game_id` ordered by `snap_ts` ascending.
- `fg_spread_home` is the **home** spread (negative = home favored); away = negation.
- **Do NOT** read `nfl_historical_odds` / `ncaaf_odds_history` directly for a card's current line —
  those are keyed by Odds-API event id (CFB) / city-name (NFL). The views remap them to the same
  `game_id` the cards use. (CFB uses kickoff + accent-insensitive team-prefix match; ~48/51 Week-1
  games resolve today. A game with no row = **odds not posted yet** → render "not posted", not an error.)
- **Opening line** = `*_slate_games.fg_*_open`. **Current line** = latest `*_line_movement` row. If
  current is missing, you may fall back to `fg_*_close` (the slate close) but **do not label the slate
  close as "current."** ML consensus is intentionally omitted from the views (median of American odds
  is invalid across ±100) — read per-book ML from the raw archive if needed.
- Snapshots accumulate hourly once the odds crons run, so the movement series densifies over the week.

## 4. Early season (CFB Weeks 1–3) — do not fabricate

- The CFB opponent-adjusted model is **cold** early, so `*_slate_picks` deliberately use the
  **early-week priors blend** (matching the header). This is by design — the numbers are sane, not the
  degenerate cold model.
- **No 1H cards or projections exist in Weeks 1–3.** `*_slate_picks` has no `h1_*` rows and
  `*_slate_games` 1H fields are null (no 1H model confidence yet, and books haven't posted 1H lines).
  The 1H section must render **empty / "not posted"** — never invent a 1H projected spread/total.

## 5. Signals — only real per-game spots

Render signals from `*_slate_picks.signal_keys` joined to `*_signal_defs`. **Never render the
blanket/base keys** as per-game signals (they fire on ~every game and are the model headline, not a
spot): NFL `sides_model`; CFB `model_lean`, `opener_under`, `rivalry_week_over`. Real early CFB
signals look like `g5_dog_wk1_bigfav`, `fade_low_total`, `fade_high_total`. See memory
`football-signals-catalog`.

## 6. Resolve the week dynamically

Always resolve the current `(season, week)` at query time — latest season, then the soonest upcoming
game for the feed. **Never hardcode `season=2025`, `week=12`, or `week=7`** — those were the old test
pins and are the #1 cause of blank/stale surfaces.
