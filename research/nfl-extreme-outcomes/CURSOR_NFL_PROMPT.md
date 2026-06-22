# Cursor build prompt — NFL game cards + prediction detail (Week 12 2025 dry run)

We're standing up the **NFL** experience on the same precomputed pattern as CFB: the frontend does **zero math**,
it just renders rows. Slate cards + a detail view with **8 prediction rows grouped into 7 cards** per game, plus
team-trends and an NFL-only **head-to-head series** card. Everything below is already computed in Supabase.

This is a **dry run** (pretend it's Wednesday of Week 12, 2025). Every model number is walk-forward, every signal
is point-in-time, every line is the real consensus snapshot, and the actual results are stored so we can validate.
Render it like the real thing — just don't surface the `final_*` columns pregame.

## Connect
```
URL:      https://jpxnjuwglavsjbgbasnl.supabase.co
anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo
```
| Table | Use | Cardinality |
|---|---|---|
| `nfl_dryrun_games` | **Slate cards** — game lines + conviction pills | 1 / game (14) |
| `nfl_dryrun_picks` | **Detail cards** — the 8 rows / 7 cards | 8 / game (112) |
| `nfl_dryrun_flags` | Fired-signal feed (secondary to picks) | (51) |
| `nfl_signal_defs` | Signal definitions (tap a signal → read it) | static (32) — cache |
| `nfl_teams` | Team logos (`logo_espn`,`logo_squared`), colors, conf | static (32) — cache |
| `nfl_sportsbooks` | Book logos (`book_key`→`logo_url`,`display_name`) | static — cache |
| `nfl_team_trends` | Per-team season-to-date trends + game_log | (32) |
| `nfl_matchup_history` | **NFL-only** last-5 head-to-head series | (70) |

Joins (NFL keys on **abbreviations**, not full names):
- `picks.game_id = games.game_id`
- `picks.signal_keys[] → signal_defs.signal_key`; `flags.signal_key → signal_defs.signal_key`
- `picks.best_book → sportsbooks.book_key` (logo also denormalized onto the pick as `best_book_logo`)
- `games.home_ab / away_ab → nfl_teams.team_abbr` (use `home_ab`/`away_ab`, NOT the display names)
- `team_trends.team_abbr → nfl_teams.team_abbr`; `game_log[].opp` is also an abbreviation
- Head-to-head: call `rpc('nfl_matchup_last5', { team_a, team_b })` (any order), or query
  `nfl_matchup_history` filtered by `matchup_key = sorted([home_ab,away_ab]).join('|')`, newest-first.

---

## SCREEN 1 — Slate (game list)
Mirror `NFLGameCard`: date/time top, **Away @ Home** with team logos (`nfl_teams.logo_espn`), each team's
**spread + moneyline**, **total** in the middle.
- Fields from `nfl_dryrun_games`: `kickoff, home_ab, away_ab, home_team, away_team, fg_spread_close,
  fg_total_close, fg_ml_home_close, fg_ml_away_close`.
- **Weather chip:** `wx_icon` (`indoor|wind|cold|clear`) + `wx_summary` (ready string, e.g. "41°F, wind 18 mph"
  or "Indoors (closed)"). For indoor games show the indoor icon, skip temp/wind.
- **Conviction pills under the lines** — read `conviction_summary` jsonb (shape below). Render one small pill
  per entry in `conviction_summary.plays`, e.g. **🥇 High Conviction: Spread**, **Lean: Total**. These name
  *which bet type* carries the play. If `mammoth=true` on the game, give the card the rare mammoth treatment.
- **Sort the slate by `conviction_tier`** (mammoth → high → med → low → lean → none), then `kickoff`.

**Predicted score:** use `fg_pred_home_pts` / `fg_pred_away_pts` — the single source of truth, byte-identical
to the team-total cards' `model_number`. Do **NOT** re-derive from total/margin.

## SCREEN 2 — Game detail. Render 7 cards from `nfl_dryrun_picks`.
Query `nfl_dryrun_picks where game_id = ? order by sort_order`. Group `card_group` into **7 cards**:
`spread (1), total (2), team_total (3+4: home & away rows), moneyline (5), h1_spread (6), h1_total (7), h1_ml (8)`.

**Every pick row carries the same fields — render identically per card:**
- `pick_label` — the headline ("Houston Texans +5.5", "Over 43.5", "Buffalo Bills Under 24.5").
- `pick_team` / `pick_side` — who/what we're on.
- **Spread picks are COVER picks, not winner picks.** On the spread and 1H-spread cards, `pick_team`/`pick_side`
  is the side that **covers the spread**, which is NOT always the predicted winner. Example: BUF@HOU 1H — the
  model has Buffalo winning the 1H by 1.1, but the line is BUF -2.5 (HOU +2.5 home dog), so **Houston covers**
  and the pick is "Houston Texans 1H +3.5". Never relabel a spread card as the projected game/half winner; the
  moneyline (card 5) and 1H-ML (card 8) cards are where the predicted *winner* lives.
- **Sign every spread number explicitly.** All spread-type fields — `model_line`, `vegas_line`, `best_line` on the
  **spread** and **1H-spread** cards, plus any handicap shown in `pick_label` — must render with a leading `+` for
  positive values (e.g. "+3.5", not "3.5") and `-` for negative, so favorite vs. underdog is unambiguous. Totals,
  Over/Under, and team-total numbers are unsigned (just "43.5", "Over 24.5"). Moneyline `vegas_price`/`best_odds`
  are American odds and keep their own `+`/`-`.
- `model_number` — our projection (margin / total pts / team pts / win prob). `model_line` — our fair line. On the
  spread + 1H-spread cards `model_line` (and `model_number`, which equals it there) is **our spread for the picked
  side**, signed like Vegas (negative = we make them a favorite, positive = underdog) — compare directly to
  `vegas_line` to see the edge.
- `vegas_line` — the line we **graded against** (see grade-line note). `vegas_price` — American odds. `edge` — points.
- **Best book**: `best_book_logo` (image) + `best_book_name`, with `best_line` and `best_odds` — the single best
  place to bet this pick. Show the logo + line/price prominently.
- `conviction` (`mammoth|high|med|low|lean|none`) → colored badge **on that card**.
- `recommendation` — **ready label, print as-is**: "MAMMOTH Play"/"High Conviction"/"Solid Play"/"Lean"/
  "Small Lean"/"No Bet"/"Predicted Winner". Do NOT compute bet quality on the frontend.
- `is_mammoth` → mammoth flourish. `stake_units` → suggested units.
- `signals` (jsonb array) → **the signal pills, with stance + the team each one backs.** Each element is
  `{ key, label, team, action, stance, tier }`:
  - `key` joins `nfl_signal_defs.signal_key` (tap → definition card).
  - `team` is the resolved team the signal points at *for this game* (e.g. "Buffalo Bills"); `null` for pure
    game-total signals (Over/Under, no team).
  - `label` is the raw side string ("BUF -2.5", "OVER 47", "BAL TT OVER 29.5").
  - **`action` is the ready, explicit "who/what to bet" directive — always render THIS as the per-game bet
    direction**, not the generic `nfl_signal_defs.bet_direction`. It already resolves to the actual team:
    side signals → `"Houston Texans (home)"` / `"Buffalo Bills (away)"`; 1H side signals →
    `"Baltimore Ravens (home 1H)"`; team-total signals → `"Tennessee Titans team total Over"`; pure
    game-total signals → just `"Over"` / `"Under"`. **When the user opens a signal's definition card from a
    game, override the static "Bet Direction" with this `action`** so it names the real team/side for that
    game (the static `bet_direction` is only a fallback when there's no game context).
  - `stance` is **`"support"`** (agrees with this card's pick) or **`"counter"`** (backs the other side).
  **Render `stance="support"` under your "Supporting Signals" header and `stance="counter"` under
  "Contradicting Signals", and show `action` (which names the team) on the pill** so the user always sees who
  the signal points at (they can't see the underlying model). `tier` = `active`/`tracking`. A signal can
  legitimately oppose our model pick (e.g. the model likes Houston but Legacy Primetime likes Buffalo) — that's
  why stance exists; never imply a counter signal supports the pick.
- `signal_keys` (text[]) — flat list of the same keys (for a quick join/dedupe); prefer `signals` for display.
  **Never show the raw signal key string** — always resolve to `nfl_signal_defs.display_name`.
- `has_play` (bool) — true = a surfaced bet (highlight); false = shown for reference.
- `display_only` (bool) — true = not a graded "bet" (NFL: moneyline, team totals, **and all three 1H cards** are
  display-only in this dry run — see honesty rules).

**What each card shows:**
1. **Spread** — `pick_team` is the side that **covers** (cover, not winner — see the cover note above), `model_line`
   vs `vegas_line` (both signed), `edge`, signals, conviction. Only card that can carry a `mammoth`. **The spread
   pick now comes from the same score/margin model that drives the predicted score and team totals**, so the spread
   pick, `model_line`, and the score header are coherent **by construction** — `model_line` always agrees in
   direction with the predicted margin (no more "model says they lose but pick says they cover" contradictions).
   The old classification cover model is **not** the pick anymore — it's a support/counter signal (`sides_model`).
   **Conviction is agreement-gated:** when the margin model and the cover model disagree on the side, conviction is
   forced to `none` (no play, shown for reference); when they agree, conviction scales with the margin edge
   (`|reg_edge|≥3` or an aligned spot → high, `≥1.5` → med, `>0` → lean) and a `mammoth` can fire. So a spread card
   with a play always has the `sides_model` signal as a **support** pill; a no-play spread card may show it as a
   **counter** pill (the two models split).
2. **Total** — `pick_side` (Over/Under), `model_number` (predicted total) vs `vegas_line`, `edge`, signals,
   conviction. Locked consensus-totals ensemble; `P11_atd_implied_over` (player-prop ATD signal) attaches here.
3. **Team Totals** — **always show both** home + away rows: `pick_team` projected pts (`model_number`) vs posted
   team total (`vegas_line`) + `edge`. **DISPLAY ONLY** — a team-total only carries a play when a tracking
   K-signal attaches (`conviction='low'`, still `display_only=true`). Otherwise `recommendation='No Bet'`.
4. **Moneyline** — predicted winner (`pick_team`) + best ML odds (`best_book_logo` + `best_odds`). No edge, no
   conviction badge — `recommendation='Predicted Winner'`, `display_only=true`.
5. **1H Spread** — the side that **covers the 1H spread** (cover, not winner — see the cover note above),
   `model_line` vs `vegas_line` (both signed). **Tracking-tier / display-only** (the 1H model is being
   paper-traded in 2026). `conviction='low'` only when a tracking signal attaches; else `none`.
6. **1H Total** — Over/Under, `model_number` vs `vegas_line`. Same tracking/display-only treatment.
7. **1H Moneyline** — predicted 1H leader + best price. Display-only "Predicted Winner".

## SCREEN 2b — Team Trends (both teams side by side)
Fetch `nfl_team_trends` for `home_ab` and `away_ab` (season=2025, through_week=11; point-in-time). Two-column block:
- **Record & rates**: `su_record`, **ATS** `ats_w-ats_l-ats_p` + `ats_pct`, **O/U** `ou_o-ou_u` + `over_pct`,
  **Team Total Over** `tt_over_pct` (`tt_o-tt_u`), **1H ATS** `h1_ats_pct`, **1H Over** `h1_over_pct`.
- **Last 5** chips from `last5_su`/`last5_ats`/`last5_ou` (newest-first): W/cover/over green, L/under red, P gray.
- **O/U graph**: plot `game_log.slice(0,5)[].ou_margin` (signed; >0 over/green, <0 under/red). `cover_margin` for ATS.
- FIGURES = season-to-date aggregate columns. GRAPHS/last-5 = `game_log.slice(0,5)` (game_log is newest-first).

The per-card trend strip (under each prediction card) and the expandable game-by-game table work exactly like CFB
SCREEN 2c/2d — map: spread→ATS, total→O/U, team_total→that team's `tt`, moneyline→`su_record`, h1_spread→`h1_ats`,
h1_total→`h1_ou`. Opponent logo+abbr from `nfl_teams` (join `game_log[].opp` = `team_abbr`).

## SCREEN 2e — Head-to-head series (NFL ONLY — CFB has no equivalent)
Call `rpc('nfl_matchup_last5', { team_a: home_ab, team_b: away_ab })` → up to 5 prior meetings, **newest-first**,
strictly before this week's kickoff. Render a compact series card:
- Each row: `date`, `away_team @ home_team` (logos via `nfl_teams.team_abbr`), final `away_score-home_score`,
  `winner_team`, `closing_spread_home`, `ats_result` (HOME/AWAY/PUSH → who covered = `cover_team`),
  `closing_total` + `ou_result` (OVER/UNDER/PUSH), `total_points`.
- Franchise relocations are already folded to current abbreviations (OAK→LV, SD→LAC, STL→LA), so the join is clean.
- `neutral_site` bool for international/neutral games.

## Best-line rules (already computed — just display)
For every pick we stored the **best number across books** in `best_book*`:
- Spread / 1H spread → most favorable line for the side. Ties → best price.
- Total / team total / 1H total → Over = lowest line, Under = highest. Ties → best price.
- Moneyline / 1H ML → highest American odds. (`best_line` is null for ML.)
Show `best_book_logo` next to `best_line` (`best_odds` for ML).

## Honesty rules (enforce in UI — these are product features)
- **Only spread + total cards can be real bets** (`has_play=true`). Team totals, moneyline, and ALL THREE 1H cards
  are `display_only=true` in this dry run. Never style them as confident bets.
- Moneyline / 1H ML have no edge — show the predicted winner + price only.
- `games.fg_home_win_prob` / `h1_home_win_prob` are **uncalibrated / display-only** (derived from a normal-margin
  approximation, no walk-forward ML model). Prefer `fg_home_cover_prob` or the predicted score. Don't present
  win-prob as a hard %.
- **Grade-line honesty** — `vegas_line` on a pick (and the flag's `grade_line` column) is the line the signal was
  *computed from*, which is the line we grade against: FG harness + consensus totals grade vs the **opener**;
  props (P11), the 1H model, and K-signals grade vs the **close**. `best_line` may differ (best currently-shoppable
  number); that's the price you'd actually get, not the graded line.
- **Weather is ACTUALS, not a pregame forecast** (h1tt realized roof/temp/wind). Fine for a dry run; do not imply
  it's a forecast in copy.
- Actuals (`final_*`, `h1_*` on games; `result` on picks) are for our validation — **never render pregame**.
- There ARE NFL player props feeding signals (ATD → `P11_atd_implied_over` on the total card), but no standalone
  props screen is required for this dry run.

## Reference files (for matching the look)
- `src/pages/NFL.tsx`, `src/components/NFLGameCard.tsx`, `src/components/GameDetailsModal.tsx`
- `src/utils/sportsbookConfig.ts` (logos now also provided via `nfl_sportsbooks`/`best_book_logo`)

## Acceptance
- Slate cards read `nfl_dryrun_games`, sorted by conviction, with pills that name the bet type + weather chip.
- BUF@HOU detail: Spread card = Houston Texans +5.5 (High Conviction, best book BetRivers) with `legacy_primetime` +
  `sides_model` + `top_vs_top_pt_home` signals tappable; Total card = Over 43.5 (Lean); team totals / ML / all 1H
  cards display-only; head-to-head series card shows prior BUF/HOU meetings newest-first.

---

# COLUMN DICTIONARY — every column, explicit. DO NOT GUESS.
Spread/total lines are HOME perspective (−7 = home favored by 7). Odds are American. Joins use abbreviations.

## `nfl_dryrun_games` (1 row per game; slate + headline)
- `game_id` text — PK, join key to picks/flags.
- `season` int (2025), `week` int (12). `gameday` date. `kickoff` timestamptz (UTC start).
- `slot` text — `sunday_early|sunday_late|snf|monday|thursday` etc (NFL time slot).
- `home_ab` / `away_ab` text — **abbreviations** (LA/WAS/JAX scheme); JOIN KEY to `nfl_teams.team_abbr`.
- `home_team` / `away_team` text — full display names (e.g. "Buffalo Bills"). Display only; don't join on these.
- `fg_spread_open` / `fg_spread_close` numeric — full-game spread (home), open & close consensus.
- `fg_total_open` / `fg_total_close` numeric — full-game O/U total, open & close.
- `fg_ml_home_close` / `fg_ml_away_close` numeric — moneyline (American) close.
- `tt_home_close` / `tt_away_close` numeric — posted team total (consensus close).
- `tt_home_over_price`/`tt_home_under_price`/`tt_away_over_price`/`tt_away_under_price` numeric — TT prices (American).
- `tt_home_best_over`/`tt_home_best_under`/`tt_away_best_over`/`tt_away_best_under` numeric — best-shop TT line
  (OVER=lowest, UNDER=highest across books).
- `tt_home_pick`/`tt_away_pick` text — model lean "OVER"/"UNDER" (display). `tt_home_edge`/`tt_away_edge` numeric.
- `tt_home_pred`/`tt_away_pred` numeric — predicted team points (mirror of `fg_pred_*_pts`).
- `h1_spread_close` numeric — 1H spread (home). `h1_spread_home_price`/`h1_spread_away_price` (American).
- `h1_total_close` numeric. `h1_total_over_price`/`h1_total_under_price` (American).
- `h1_ml_home_close`/`h1_ml_away_close` numeric — 1H moneyline (American).
- `h1_spread_pick`/`h1_total_pick`/`h1_ml_pick` text — ready 1H pick labels (display).
- `fg_pred_margin` numeric — model predicted home margin (positive = home wins by).
- `fg_pred_spread` numeric — = −fg_pred_margin (our fair home spread).
- `fg_pred_home_pts`/`fg_pred_away_pts` numeric — **PREDICTED SCORE. USE THESE for the headline.** Identical to
  the team-total cards. Do NOT recompute.
- `fg_spread_edge` numeric — model edge on the spread (points). `fg_spread_pick` text — "AB ±x" or "NEUTRAL";
  this is the **margin/score model's** cover side (matches the spread detail card and the predicted score).
- `fg_spread_confluence` int (0/1) — 1 when the margin/score model and the classification cover model agree on the
  side with `|reg_edge|≥1.5` (the agreement gate behind spread conviction).
- `fg_pred_total` numeric — model predicted game total. `fg_total_edge` numeric. `fg_total_pick` text
  "OVER"/"UNDER"/"NEUTRAL". `fg_total_tier` text ("HC"/"LEAN"/"WEAK"/"NONE").
- `fg_home_cover_prob` numeric 0–1 — REAL walk-forward prob home covers from the classification cover model (ok to
  show). This model no longer drives the spread pick — it's the `sides_model` support/counter signal + the
  agreement gate; the spread pick comes from the margin/score model.
- `fg_home_win_prob` numeric 0–1 — DISPLAY-ONLY/uncalibrated; don't present as a hard %.
- `h1_pred_total`/`h1_pred_margin` numeric — 1H predictions. `h1_total_edge`/`h1_cover_tilt` numeric — 1H model
  residuals. `h1_home_win_prob` numeric 0–1 — uncalibrated, display only.
- `conviction_tier` text — game's top conviction (mammoth/high/med/low/lean/none).
- `stake_units` numeric — units of the top play.
- `conviction_summary` jsonb — **object** (NOT an array):
  `{ top_card: <bet_type>, top_conviction: <tier>, plays: [ {card_group, conviction, recommendation, pick_label} ] }`.
  `plays` is sorted strongest-first and contains only `has_play=true` picks. Render one pill per `plays` entry.
- `flags_active` / `flags_tracking` int — count of fired signals (active vs tracking tier).
- `mammoth` bool — game has a mammoth play (only the spread card can be mammoth).
- **Weather (ACTUALS, not a forecast):** `wx_temp_f` (°F), `wx_wind_mph`, `wx_precip_mm` (always null here),
  `wx_indoors` bool, `wx_icon` (`indoor|wind|cold|clear`), `wx_summary` (ready string).
- `final_home`/`final_away`/`h1_home`/`h1_away` int — ACTUAL scores. VALIDATION ONLY — never show pregame.

## `nfl_dryrun_picks` (8 rows per game; the prediction cards)
- `id` bigint PK. `game_id` text (join to games). `season`/`week`.
- `card_group` text — `spread|total|team_total|moneyline|h1_spread|h1_total|h1_ml` (group into 7 cards).
- `bet_type` text — like card_group but team totals split into `team_total_home`/`team_total_away`.
- `sort_order` int — 1 spread … 8 h1_ml.
- `pick_side` text — "HOME"/"AWAY"/"OVER"/"UNDER". For spread/1H-spread this is the **cover** side, not the winner.
- `pick_team` text — resolved full team name for side picks (the side that covers, for spread cards).
- `pick_label` text — ready headline ("Houston Texans +5.5", "Over 43.5"). Spread handicaps are signed (`+`/`-`).
- `model_number` numeric — our projection (margin / total pts / team pts / win prob for ML). On spread/1H-spread
  it equals `model_line` (our signed spread for the picked side).
- `model_line` numeric — our fair line for the pick side, signed like Vegas (negative = favorite). null for ML.
  Render with an explicit `+` when positive.
- `vegas_line` numeric — the line we **graded against** (opener for spread/total, close for 1H/TT), signed for
  spreads (render explicit `+`). null for ML.
- `vegas_price` numeric — consensus odds (American).
- `edge` numeric — model advantage in points (null for ML & display-only cards).
- `best_book` text — book key (join `nfl_sportsbooks.book_key`). `best_book_name` / `best_book_logo` — denormalized.
- `best_line` numeric — best line across books (null for ML). `best_odds` numeric — best American odds.
- `conviction` text — `mammoth|high|med|low|lean|none` (badge styling).
- `recommendation` text — **READY LABEL, print as-is** (see list above; ML/1H-ML = "Predicted Winner").
- `is_mammoth` bool. `stake_units` numeric.
- `has_play` bool — true = surfaced bet (only spread/total here). `display_only` bool — true = info, not a graded bet.
- `signals` jsonb — array of `{key, label, team, action, stance, tier}` per fired signal on this card.
  `key`→`nfl_signal_defs`, `team`=resolved team it backs this game (null for pure totals), `label`=raw side
  ("BUF -2.5"), `action`=**ready per-game bet directive that names the team** ("Houston Texans (home)",
  "Tennessee Titans team total Over", "Over"), `stance`=`support`|`counter` (vs this card's pick),
  `tier`=`active`|`tracking`. Group support vs counter under the two headers; show `action` on each pill, and
  use `action` as the "Bet Direction" when the signal's definition card is opened from this game.
- `signal_keys` text[] — flat keys (same set; join helper). Prefer `signals` for rendering.
- `result` text — win/loss/push. VALIDATION ONLY (null on display-only cards).

## `nfl_dryrun_flags` (the fired-signal feed; secondary to picks)
- `game_id`/`season`/`week`. `game` text ("AWAY@HOME"). `source` text (internal — DON'T show).
- `rule`/`signal_key` text — join to `nfl_signal_defs.signal_key`. `tier` text (`active`/`tracking`).
- `market`/`side`/`line`/`price`/`edge`. `mammoth` bool. `conviction` text. `stake_units` numeric.
- `grade_line` text — `open`/`close`: which line this signal is graded against (see honesty rules).

## `nfl_signal_defs` (static; 32; tap a signal → definition)
- `signal_key` text PK (matches picks.signal_keys[] and flags.signal_key).
- `display_name`/`one_liner`/`definition`/`why_it_works`/`bet_direction`/`typical_hit` text.
- `market` text, `default_conviction` text.

## `nfl_team_trends` (1 row per team; season-to-date through week 11)
FIGURES = season aggregates. GRAPHS/last-5 = `game_log.slice(0,5)` / `last5_*`.
- `team_abbr` text (join to nfl_teams), `team_name`, `season`, `through_week` (11), `games` int.
- `su_w`/`su_l`/`su_record`. `ats_w`/`ats_l`/`ats_p`/`ats_pct`. `ou_o`/`ou_u`/`ou_p`/`over_pct`.
- `tt_o`/`tt_u`/`tt_games`/`tt_over_pct`. `h1_ats_w/l/p`/`h1_ats_games`/`h1_ats_pct`. `h1_ou_o`/`h1_ou_u`/`h1_ou_games`/`h1_over_pct`.
- `last5_su`/`last5_ats`/`last5_ou` text[] (newest-first).
- `game_log` jsonb — array (newest-first) of per-game objects:
  `{week, opp (abbr), date, is_home, team_pts, pts_for, pts_against, total_points, spread, total, tt_line,
    h1_spread, h1_total, su, ats, ou, tt, h1_ats, h1_ou, cover_margin, ou_margin, tt_margin, h1_cover_margin, h1_ou_margin}`.
  Positive margin = cover/over (green), negative = fail/under (red).

## `nfl_matchup_history` (NFL ONLY; last-5 head-to-head series; 70 rows)
Query via `rpc('nfl_matchup_last5', { team_a, team_b })` (newest-first, capped 5) or filter `matchup_key`.
- `matchup_key` text — sorted abbrevs joined "|" (e.g. "BUF|HOU"). `game_id`/`season`/`week`/`date`.
- `away_team`/`home_team` text — **abbreviations** (relocations folded to current). `neutral_site` bool.
- `away_score`/`home_score`/`total_points` int.
- `closing_spread_home` numeric (negative = home favored). `closing_total` numeric.
- `closing_ml_home`/`closing_ml_away` int.
- `winner_team`/`cover_team` text (abbr; null = push/tie). `ats_result` (HOME/AWAY/PUSH). `ou_result` (OVER/UNDER/PUSH).
- `cover_margin_home`/`ou_margin` numeric.

## `nfl_teams` (static; 32; cache)
- `team_abbr` text PK (JOIN KEY). `team_name`/`team_nick`/`team_conf`/`team_division`.
- `team_color`..`team_color4` (hex). `logo_espn`/`logo_squared`/`logo_wikipedia`/`wordmark`/`conference_logo`/`league_logo`.

## `nfl_sportsbooks` (static; cache)
- `book_key` text PK (matches picks.best_book). `display_name`. `logo_url`. `domain`.

---

# VALIDATION QUERIES (Week 12 2025, BUF@HOU as the worked example)

```sql
-- 0. row counts (expect 14 games / 112 picks / 23 plays / 51 flags)
select
 (select count(*) from nfl_dryrun_games  where season=2025 and week=12) games,
 (select count(*) from nfl_dryrun_picks  where season=2025 and week=12) picks,
 (select count(*) from nfl_dryrun_picks  where season=2025 and week=12 and has_play) plays,
 (select count(*) from nfl_dryrun_flags  where season=2025 and week=12) flags;

-- 1. one game's headline (slate)
select home_ab, away_ab, kickoff, fg_spread_close, fg_total_close,
       fg_pred_home_pts, fg_pred_away_pts, conviction_tier, mammoth,
       wx_icon, wx_summary, conviction_summary
from nfl_dryrun_games
where season=2025 and week=12 and home_ab='HOU' and away_ab='BUF';

-- 2. that game's 7 cards (detail), in display order
select sort_order, card_group, bet_type, pick_label, model_number, model_line,
       vegas_line, vegas_price, edge, best_book, best_line, best_odds,
       conviction, recommendation, has_play, display_only, signal_keys, result
from nfl_dryrun_picks p
join nfl_dryrun_games g using (game_id)
where g.season=2025 and g.week=12 and g.home_ab='BUF' and g.away_ab='HOU'
order by p.sort_order;

-- 3. resolve the signal pills on that game's cards
select distinct d.signal_key, d.display_name, d.definition, d.bet_direction, d.typical_hit
from nfl_dryrun_picks p
join nfl_dryrun_games g using (game_id)
join nfl_signal_defs d on d.signal_key = any(p.signal_keys)
where g.season=2025 and g.week=12 and g.home_ab='BUF' and g.away_ab='HOU';

-- 4. team trends for both sides
select team_abbr, su_record, ats_w, ats_l, ats_pct, over_pct, tt_over_pct,
       last5_ats, last5_ou
from nfl_team_trends
where season=2025 and through_week=11 and team_abbr in ('BUF','HOU');

-- 5. head-to-head series (NFL-only card)
select * from nfl_matchup_last5('BUF','HOU');

-- 6. best-book join sanity (logo denormalized + resolvable)
select p.bet_type, p.best_book, p.best_book_name, p.best_book_logo, s.logo_url
from nfl_dryrun_picks p
left join nfl_sportsbooks s on s.book_key = p.best_book
where p.season=2025 and p.week=12 and p.best_book is not null
limit 10;
```
