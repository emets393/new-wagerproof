# Cursor build prompt — College Football game cards + prediction detail (Week 7 2025 dry run)

We're rebuilding the **College Football** experience so it (a) looks like the NFL cards on the slate and
(b) cleanly presents all 7 prediction types per game on the detail view. Everything is **precomputed in
Supabase** — the frontend does **zero math**, it just renders rows. You already own the styling/components;
this tells you the data and the layout.

## ⚠️ First: the current CFB page reads the WRONG data
`src/pages/CollegeFootball.tsx` + `src/components/CFBGameCard.tsx` currently read the legacy
`cfb_live_weekly_inputs` / `cfb_api_predictions` tables — that's why CFB looks nothing like NFL. **Switch CFB
to the dry-run tables below** and mirror the NFL card layout in `src/pages/NFL.tsx` / `src/components/NFLGameCard.tsx`.

## Connect
```
URL:      https://jpxnjuwglavsjbgbasnl.supabase.co
anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo
```
| Table | Use | Cardinality |
|---|---|---|
| `cfb_dryrun_games` | **Slate cards** — game lines + conviction pills | 1 / game (56) |
| `cfb_dryrun_picks` | **Detail cards** — the 7 prediction cards | ~7 / game (398) |
| `cfb_signal_defs` | Signal definitions (tap a signal → read it) | static (31) — cache |
| `cfb_teams` | Team logos (`logo`, `logo_dark`), `abbr`, `color`, `conference` | static (137) — cache |
| `cfb_sportsbooks` | Book logos (`book_key`→`logo_url`,`display_name`) | static (12) — cache |
Joins: `picks.game_id = games.game_id`; `picks.signal_keys[] → signal_defs.signal_key`;
`picks.best_book → sportsbooks.book_key` (logo also denormalized onto the pick as `best_book_logo`);
`games.home_team/away_team → cfb_teams.team_name`.

---

## SCREEN 1 — Slate (game list). Make it look like NFL.
Mirror `NFLGameCard`: date/time top, **Away  @  Home** with team logos (from `cfb_teams.logo`), each team's
**spread + moneyline**, **total** in the middle. CFB additions:
- **AP rank badge** ("#7") when `home_rank`/`away_rank` is non-null.
- Fields from `cfb_dryrun_games`: `kickoff, home_team, away_team, home_rank, away_rank, fg_spread_close,
  fg_total_close, fg_ml_home_close, fg_ml_away_close`. **Weather chip:** `wx_icon` + `wx_summary` (like the NFL card).
- **Conviction pills under the lines** — read `conviction_summary` (jsonb array of
  `{card:"spread"|"total"|"team_total"|"moneyline"|"h1_spread"|"h1_total"|"h1_ml", conviction:"mammoth|high|med|low|lean", mammoth:bool}`).
  Render one small pill per entry, e.g. **🔶 Mammoth: Spread**, **🥇 Strong: Team Total**, **🥈 Total**.
  These tell the user *which bet type* carries the play (fixes "banner says mammoth but which one?").
  If a game has a `mammoth:true` entry, give the whole card the rare mammoth treatment.
- **Sort the slate by top conviction** (mammoth → high → med → low → lean → none), then kickoff.

**Predicted score (everywhere it appears):** use the precomputed `cfb_dryrun_games.fg_pred_home_pts` /
`fg_pred_away_pts` columns. **Do NOT re-derive from total/margin.** These are the *single source of truth* for
team points and are byte-identical to the team-total cards' `cfb_dryrun_picks.model_number` — so the headline
"HOU 32.3 · OKST 17.0" and the team-total card "Houston 32.3" always match. (This was previously inconsistent
because two different models were used; now everything derives from one full-game model.)

## SCREEN 2 — Game detail. Render the 7 prediction cards from `cfb_dryrun_picks`.
Query `cfb_dryrun_picks where game_id = ? order by sort_order`. Group by `card_group` into **7 cards**:
`spread, total, team_total (two rows: home+away), moneyline, h1_spread, h1_total, h1_ml`.

**Every pick row carries the same fields — render them identically per card:**
- `pick_label` — the headline (e.g. "Ohio State −14.5", "Over 51.5", "Illinois Over 17.5").
- `pick_team` / `pick_side` — who/what we're on.
- `model_line` — **our** number. `vegas_line` — the consensus line. `edge` — our advantage (points).
- **Best book**: `best_book_logo` (image) + `best_book_name`, with `best_line` and `best_odds`. This is the
  single best place to bet this pick (see rules below). Show the book logo + the line/price prominently.
- `conviction` (`mammoth|high|med|low|lean|none`) → a colored badge **on that specific card**.
- `recommendation` — a **ready-to-display bet-quality label** ("MAMMOTH Play" / "High Conviction" /
  "Solid Play" / "Lean" / "Small Lean" / "No Bet"). Print it as-is; do NOT compute bet quality on the
  frontend. Applies to every card including BOTH team totals (e.g. team total = "High Conviction" or "No Bet").
- `is_mammoth` → mammoth flourish on that card.
- `signal_keys` (array) → render a **clickable signal pill** for each, **under that card**. On tap, look up
  `cfb_signal_defs` by `signal_key` and show `display_name`, `definition`, `why_it_works`, `bet_direction`,
  `typical_hit`. **Never show the raw signal string.**
- `has_play` (bool) — true = a real surfaced pick (highlight it); false = shown for reference only.
- `display_only` (bool) — moneyline & capped spreads: show the prediction + price, but it's not a "bet".

**What each card shows (per your spec):**
1. **Spread** — `pick_team` to cover, `model_line` vs `vegas_line`, `edge`, signal pills, conviction badge.
   (If `display_only` because the model is >14 off the market, show "model off-market — no play".)
2. **Total** — `pick_side` (Over/Under), `model_line` vs `vegas_line`, `edge`, signals, conviction.
3. **Team Totals** — **always show both** `team_total_home` + `team_total_away` rows: each is
   `pick_team` projected points (`model_number`) vs its posted team total (`vegas_line`) + `edge`. Highlight
   the one(s) with `has_play=true`; the others are informational. (This is the section that was missing the
   prediction + edge — both are now on the row.)
4. **Moneyline** — show the **predicted winner** (`pick_team`, derived from our predicted score) and the
   **best moneyline odds** with the book (`best_book_logo` + `best_odds`). **No conviction badge and no edge**
   — CFB moneyline is market-efficient, so we don't grade it. **If `signal_keys` is non-empty, render the
   signal pill(s)** under the card exactly like the other bet types (tap → `cfb_signal_defs`); otherwise show
   no pills. `display_only=true`.
5. **1H Spread** — predicted side, `model_line` vs `vegas_line`, `edge`, signals, conviction.
6. **1H Total** — Over/Under, `model_line` vs `vegas_line`, `edge`.
7. **1H Moneyline** — predicted 1H leader + best price; `has_play=true` only when it's the tracked
   underdog-conversion (small-stake / "watch").



## SCREEN 2b — Team Trends section (on game detail, both teams side by side)
Fetch `cfb_team_trends` for `home_team` and `away_team` (season=2025). Point-in-time season-to-date (wk1-6).
Show a two-column block (away | home):
- **Record & rates** (each with count + %): `su_record` (e.g. 4-0), **ATS** `ats_w-ats_l-ats_p` + `ats_pct`,
  **O/U** `ou_o-ou_u` + `over_pct`, **Team Total Over** `tt_over_pct` (`tt_o-tt_u`), **1H ATS** `h1_ats_pct`,
  **1H Over** `h1_over_pct`.
- **Last 5** chips from `last5_su` / `last5_ats` / `last5_ou` (newest-first): W=green, L=red, P=gray; O=green, U=red.
- **Over/Under graph**: read `game_log[]` and plot `ou_margin` per game by `week` — a signed bar chart
  (above 0 = over, green; below 0 = under, red). Same idea works for `cover_margin` (ATS) if you want a second graph.
- (Optional) a full game-by-game table straight from `game_log` (opp, score, ATS, O/U, team total, 1H).
All values precomputed — render directly, no math.



## SCREEN 2c — Team-trend strip UNDER each prediction card (no toggle; both teams side-by-side)
Fetch `cfb_team_trends` once per game (home_team + away_team, season=2025); reuse across all cards.
**TWO data reads:** (1) the **figures/records/%** are SEASON-TO-DATE — use the aggregate columns (`ats_pct`,
`over_pct`, `su_record`, `tt_over_pct`, `h1_*`, with counts). (2) the **graphs + last-5 chips** show only the
**LAST 5 GAMES** (or fewer if <5 played) — use `game_log.slice(0,5)` (game_log is newest-first) / the `last5_*`
arrays (already capped at 5). Do NOT graph the whole season — figures = season, charts = last 5.
Under each prediction card (below the signal pills) add a compact TWO-COLUMN strip — Away (left) | Home (right) — team
logo + the relevant stat + last-5 chips + a small graph where noted. No toggle (figures are small; the O/U graph
is only 4-6 bars, both teams fit). Map card -> stat:
- Spread card -> ATS: `ats_w-ats_l-ats_p` + `ats_pct`, `last5_ats` chips; optional mini-bars from game_log[].cover_margin.
- Over/Under card -> O/U: `ou_o-ou_u` + `over_pct`, `last5_ou` chips, + over/under bar graph from game_log.slice(0,5)[].ou_margin
  (LAST 5 games only; >0 over/green, <0 under/red), one small chart per team side-by-side.
- Team Total card (per team) -> that team's `tt_over_pct` + `tt_o-tt_u`; last-N from game_log[].tt.
- Moneyline -> `su_record` + `last5_su` chips.
- 1H Spread -> `h1_ats_pct` (+w-l); last-5 from game_log[].h1_ats. 1H Total -> `h1_over_pct`; last-5 from game_log[].h1_ou.
Header each strip with sample size (`games`/`through_week`). Colors: cover/over/win green, fail/under/loss red, push gray.



## SCREEN 2d — Expandable trend detail (click a trend card -> full game-by-game table)
Make every team-trend card (SCREEN 2c) **look clickable**: pointer cursor, subtle hover/press state, and a small
hint/tooltip "Click to expand" (or a chevron). On click, open a modal / bottom-sheet titled e.g. "Ohio State —
ATS this season" with a **game-by-game table built from that team's `game_log`** (already fetched; use the FULL
log season-to-date, newest first — not just last 5). One table per bet type, columns:
- **Spread**: Date | Opponent (logo + abbr) | Spread | Result chip (W/L/P) | ATS +/- (`cover_margin`)
- **Over/Under**: Date | Opp | Total | Result (O/U/P) | +/- (`ou_margin`)  [optional: Final total `total_points`]
- **Team Total**: Date | Opp | TT line (`tt_line`) | Result (`tt` O/U) | Team Pts (`team_pts`) | +/- (`tt_margin`)
- **Moneyline**: Date | Opp | Score (`pts_for`-`pts_against`) | Result (`su` W/L)
- **1H Spread**: Date | Opp | 1H Spread (`h1_spread`) | Result (`h1_ats`) | +/- (`h1_cover_margin`)
- **1H Total**: Date | Opp | 1H Total (`h1_total`) | Result (`h1_ou`) | +/- (`h1_ou_margin`)
Rules: opponent logo + abbr come from `cfb_teams` (join on `game_log[].opp` = full team name). Color the result
chips (W/cover/over green, L/under red, P gray) and the +/- value (positive green, negative red). Skip rows where
the bet type's field is null (e.g. a game with no posted team total). The example in the screenshot is the ATS
table; build the analogous table for every bet type from the same `game_log` fields above. All data is in the
`game_log` already on the screen — no extra fetch.

## Best-line rules (already computed — just display)
For every pick we picked the **best number across 11 books** and stored it in `best_book*`:
- Spread / 1H spread → the most favorable line for the side (e.g. lay −14.5 instead of −15; take +10.5
  instead of +10). Ties → best price.
- Total / team total / 1H total → Over = lowest line, Under = highest line. Ties → best price.
- Moneyline / 1H ML → highest American odds (best payout).
Show `best_book_logo` next to `best_line` (`best_odds` for ML). If you ever want to restrict to books a user
has, filter by `best_book`, but the default is the true best available.

## Honesty rules (enforce in UI — these are product features)
- `display_only=true` (moneyline, capped spread) → never style as a confident "bet".
- Moneyline has no edge — show the winner + price only.
- `cfb_dryrun_games.fg_home_win_prob` is **display-only/uncalibrated** — prefer `fg_home_cover_prob` or the
  predicted score (`(fg_pred_total ± fg_pred_margin)/2`). Don't present win-prob as a hard number.
- Actuals (`final_*`, `h1_*` on games) are for our validation — **never render pregame**.
- There are **no CFB player props** — no props screen.

## Reference files (for matching NFL look)
- `src/pages/NFL.tsx` (slate card render), `src/components/NFLGameCard.tsx` (card shell)
- `src/components/GameDetailsModal.tsx` (NFL bet detail pattern)
- `src/utils/sportsbookConfig.ts` (book keys; logos now provided via `cfb_sportsbooks`/`best_book_logo`)

## Acceptance
- CFB slate cards visually match NFL (logos, lines), reading `cfb_dryrun_games`, with conviction pills that
  name the bet type.
- Ohio State @ Illinois shows a 🔶 Mammoth pill for Spread on the slate; in detail, the Spread card = Ohio
  State −14.5 (best book LowVig) with the Big Ten road-fav + premium-lay-fav signals tappable.
- Each game's detail shows 7 cards; team totals always shows both teams with projection + edge; every pick
  shows the best book logo + line; signals open a definition card; ML is display-only.

---

# COLUMN DICTIONARY — every column, explicit. DO NOT GUESS.
Spread/total lines are HOME perspective (−7 = home favored by 7). Odds are American. "rate %" columns are 0–100.

## `cfb_dryrun_games` (1 row per game; slate + headline)
- `game_id` bigint — PK, join key to picks/flags.
- `season` int (2025), `week` int (7).
- `kickoff` timestamptz — game start.
- `neutral_site` bool.
- **Weather** (Visual Crossing forecast): `wx_temp_f` (°F), `wx_wind_mph`, `wx_precip_mm`, `wx_indoors` (bool=dome),
  `wx_icon` (key: clear|rain|snow|wind|cold|hot|indoors -> map to your weather icon), `wx_summary` (ready string,
  e.g. "61°F · 7 mph wind" or "Indoors (dome)"). Show a small weather chip on the slate card (icon + summary);
  for domes show the indoor icon and skip temp/wind.
- `home_team` / `away_team` text — full names; join to `cfb_teams.team_name`.
- `home_conf` / `away_conf` text — conference.
- `home_rank` / `away_rank` int — AP rank 1–25, NULL = unranked (show "#7" badge only if not null).
- `fg_spread_open` / `fg_spread_close` numeric — full-game spread (home), open & close consensus.
- `fg_total_open` / `fg_total_close` numeric — full-game O/U total, open & close.
- `fg_ml_home_close` / `fg_ml_away_close` numeric — moneyline (American) close.
- `tt_home_close` / `tt_away_close` numeric — posted team total (consensus close) for each team.
- `tt_home_best_under` / `tt_home_best_over` numeric — best-shop team-total line for home (UNDER=highest, OVER=lowest). Same for `tt_away_*`.
- `h1_spread_close` numeric — 1st-half spread (home). `h1_total_close` — 1st-half total. `h1_ml_home_close`/`h1_ml_away_close` — 1H moneyline.
- `fg_pred_margin` numeric — model predicted home margin (positive = home wins by).
- `fg_pred_spread` numeric — = −fg_pred_margin (our fair spread, home).
- `fg_pred_home_pts` / `fg_pred_away_pts` numeric — **PREDICTED SCORE. USE THESE for the headline score.** Identical to the team-total cards. Do NOT recompute.
- `fg_spread_edge` numeric — model edge on the spread (points, our advantage).
- `fg_spread_pick` text — "HOME"/"AWAY" model side (NULL if capped).
- `fg_spread_capped` bool — true = |edge|>14 = model off-market, show "no play".
- `fg_pred_total` numeric — model predicted game total. `fg_total_edge` — total edge. `fg_total_pick` "OVER"/"UNDER".
- `fg_home_cover_prob` numeric 0–1 — REAL walk-forward prob home covers (ok to show).
- `fg_home_win_prob` numeric 0–1 — DISPLAY-ONLY/uncalibrated; don't present as a hard %.
- `tt_home_pred` / `tt_away_pred` numeric — predicted team points (mirror of fg_pred_*_pts). `tt_home_pick`/`tt_away_pick` text "OVER"/"UNDER"/null.
- `h1_pred_margin` / `h1_pred_total` numeric — 1H predictions. `h1_spread_pick`/`h1_total_pick`/`h1_ml_pick` text.
- `conviction_tier` text — game's top conviction (mammoth/high/med/low/lean/none).
- `stake_units` numeric — game-level stake of the top play.
- `n_flags_active` / `n_flags_tracking` int — count of fired signals.
- `mammoth` bool — game has a mammoth play.
- `conviction_summary` jsonb — array `[{card, conviction, mammoth}]` for the slate pills (which bet types carry plays).
- `final_home`/`final_away`/`h1_home`/`h1_away` int — ACTUAL scores. VALIDATION ONLY — never show pregame.

## `cfb_dryrun_picks` (~8 rows per game; the prediction cards)
- `id` bigint PK. `game_id` bigint (join to games). `season`/`week`.
- `card_group` text — `spread|total|team_total|moneyline|h1_spread|h1_total|h1_ml` (group rows into 7 cards).
- `bet_type` text — like card_group but team totals split into `team_total_home`/`team_total_away`.
- `sort_order` int — card display order (1 spread … 7 h1_ml).
- `pick_side` text — "HOME"/"AWAY"/"OVER"/"UNDER" — the model's lean (null only when no line exists).
- `pick_team` text — resolved team for side picks.
- `pick_label` text — ready headline e.g. "Iowa −4", "Over 37", "Houston Over 31.5".
- `model_number` numeric — our projection (margin / total points / team points). For team totals = predicted team points (= games.fg_pred_*_pts).
- `model_line` numeric — our fair line for the pick side.
- `vegas_line` numeric — consensus line for the pick side.
- `vegas_price` numeric — consensus odds (American), mainly ML.
- `edge` numeric — model advantage in points (null for ML).
- `best_book` text — bookmaker key with the best number. `best_book_name` text — display name. `best_book_logo` text — logo URL (render the image).
- `best_line` numeric — best line across books for the pick. `best_odds` numeric — best American odds.
- `conviction` text — `mammoth|high|med|low|lean|none` (badge styling).
- `recommendation` text — **READY LABEL, print as-is**: "MAMMOTH Play"/"High Conviction"/"Solid Play"/"Lean"/"Small Lean"/"No Bet"/"Predicted Winner".
- `is_mammoth` bool. `stake_units` numeric.
- `has_play` bool — true = surfaced bet; false = projection shown for reference.
- `display_only` bool — true = moneyline / capped spread (info, not a graded bet).
- `signal_keys` text[] — signals on this card; join each to `cfb_signal_defs.signal_key`, render a tappable pill.
- `result` text — win/loss/push. VALIDATION ONLY.

## `cfb_team_trends` (1 row per team; season-to-date AS OF pre-week-7)
FIGURES = season-to-date (use these columns). GRAPHS/last-5 = `game_log.slice(0,5)` or the `last5_*` arrays.
- `team_name` text (join to cfb_teams), `season` int, `through_week` int (6), `games` int (sample size).
- `su_w`/`su_l` int, `su_record` text ("4-1") — straight-up wins/losses.
- `ats_w`/`ats_l`/`ats_p` int, `ats_pct` numeric — against the spread (cover %).
- `ou_o`/`ou_u`/`ou_p` int, `over_pct` numeric — game over/under (over %).
- `tt_o`/`tt_u` int, `tt_games` int, `tt_over_pct` numeric — TEAM total over %.
- `h1_ats_w`/`h1_ats_l`/`h1_ats_p` int, `h1_ats_games` int, `h1_ats_pct` numeric — 1st-half ATS.
- `h1_ou_o`/`h1_ou_u` int, `h1_ou_games` int, `h1_over_pct` numeric — 1st-half over %.
- `last5_su` text[] — newest-first ["W","L",…]. `last5_ats` text[] ["W","L","P"]. `last5_ou` text[] ["O","U","P"].
- `game_log` jsonb — array (newest-first) of per-game objects:
  `{week, date, opp, is_home, pts_for, pts_against, su("W"/"L"), spread, ats("W"/"L"/"P"), cover_margin,
    total, ou("O"/"U"/"P"), total_points, ou_margin, tt_line, tt("O"/"U"/null), team_pts,
    h1_spread, h1_ats("W"/"L"/"P"/null), h1_cover_margin, h1_total, h1_ou("O"/"U"/null), h1_ou_margin, tt_margin}`.
  `cover_margin`=ATS +/- (actual margin − spread, signed). `ou_margin`=O/U +/- (total − line). `tt_margin`=team pts − team total.
  `h1_cover_margin`/`h1_ou_margin`=1H +/-. Positive=cover/over (green), negative=fail/under (red).
  Use `ou_margin` (signed: actual total − line) for the over/under bar graph; `cover_margin` for an ATS graph.

## `cfb_signal_defs` (static; tap a signal → definition)
- `signal_key` text PK (matches picks.signal_keys[] and flags.signal_key).
- `display_name` text — title. `one_liner` text — chip subtitle. `definition` text — what it means.
- `why_it_works` text — mechanism. `bet_direction` text — how the side is chosen. `typical_hit` text — validated rate.
- `market` text, `default_conviction` text.

## `cfb_teams` (static; 137; cache)
- `team_name` text PK (join key). `abbr` text (official, e.g. OSU). `conference` text. `classification` text (P5/FBS).
- `color`/`alt_color` text (hex). `logo` text (light logo URL). `logo_dark` text (dark logo URL).

## `cfb_sportsbooks` (static; 12; cache)
- `book_key` text PK (matches picks.best_book). `display_name` text. `logo_url` text. `domain` text.

## `cfb_dryrun_flags` (193; the picks feed — secondary to picks)
- `game_id`, `season`, `week`, `game` ("Away @ Home"), `source` (internal name — DON'T show), `signal_key` (join to defs),
  `market`, `side`, `line`, `price`, `edge`, `conviction`, `tier` ("active"/"tracking"), `stake_units`, `grade_line`, `mammoth`.
