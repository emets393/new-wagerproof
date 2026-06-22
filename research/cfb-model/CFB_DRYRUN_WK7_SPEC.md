# CFB Week 7 2025 Dry-Run — Data Contract

Point-in-time staging of the **frozen conviction-weighted CFB portfolio** (LOCKED_MODELS.md §12) for
2025 Week 7, used to build and validate the full user-facing experience before the season. Same pattern as
the NFL dry run. **CFB has no player props** — there is no props table.

## How to connect
```
URL:       https://jpxnjuwglavsjbgbasnl.supabase.co
anon key:  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo
```
All three tables are **public-read** (anon + authenticated `select`). Example:
```js
const { data: games } = await supabase.from('cfb_dryrun_games').select('*').eq('week',7).order('kickoff')
const { data: flags } = await supabase.from('cfb_dryrun_flags').select('*').eq('game_id', game.game_id)
const { data: teams } = await supabase.from('cfb_teams').select('*')   // fetch once, cache
```
Join keys: `cfb_dryrun_flags.game_id = cfb_dryrun_games.game_id`; `cfb_teams.team_name = games.home_team / away_team`.

## Honesty rules baked into the data (do not "fix" in the UI)
- **Walk-forward / point-in-time:** every model number trained only on data before 2025 (2016–2024); as-of
  team features computed through Week 6. No look-ahead.
- **Grade line = signal line:** each flag's `line` is the exact line the signal fired from (`grade_line`
  tells you which snapshot: open / close / soft / dk / best). Never substitute a different snapshot.
- **Actuals are validation-only:** `final_home/away`, `h1_home/away` are stored so we can score the week —
  **never display them pregame.**

---

## Table 1 — `cfb_dryrun_games` (56 rows; ONE per Week-7 FBS game, every game gets a number)
Identity: `game_id, season, week, kickoff (tz), neutral_site, home_team, away_team, home_conf, away_conf,
home_rank, away_rank` (rank is int 1–25 or **null = unranked**; show the AP # badge only when present).

**Market lines (consensus):**
`fg_spread_open/close` (home perspective: −7 = home favored by 7), `fg_total_open/close`,
`fg_ml_home_close/fg_ml_away_close` (American), `tt_home_close/tt_away_close` (team totals),
`tt_home_best_under/over` + `tt_away_best_under/over` (best-shop numbers — bet UNDER at the **highest**,
OVER at the **lowest**), `h1_spread_close/h1_total_close/h1_ml_home_close/h1_ml_away_close`.

**Model predictions:**
- `fg_pred_margin` (home margin), `fg_pred_spread` (= −margin, the number to show vs the line),
  `fg_spread_edge` (model − market, the disagreement), `fg_spread_pick` (HOME/AWAY = **model side**),
  `fg_spread_capped` (true when |edge| > 14 → **no play, show "model uncertain — off-market"**, see §rules).
- `fg_pred_total`, `fg_total_edge`, `fg_total_pick` (OVER/UNDER).
- `fg_pred_home_pts`/`fg_pred_away_pts` — predicted team points (SINGLE SOURCE for the headline score AND the
  team-total cards; use these, don't re-derive). `tt_home_pred/tt_away_pred` mirror them; `tt_*_pick` = UNDER/OVER/null.
- `h1_pred_margin`, `h1_pred_total`, `h1_spread_pick`, `h1_total_pick`, `h1_ml_pick`.
- `fg_home_cover_prob` — **real** walk-forward confirm-classifier probability the home side covers (0–1).
- `fg_home_win_prob` — **DISPLAY-ONLY** rough logistic from margin; do NOT present as calibrated. Prefer
  `fg_home_cover_prob` or just the predicted score; raw win-prob is overconfident OOS (our calibration finding).

**Conviction / portfolio:** `conviction_tier` ∈ {mammoth, high, med, low, lean, none}, `stake_units`
(5/3/2/1/0.5/0), `n_flags_active`, `n_flags_tracking`, `mammoth` (bool).

**Actuals (validation only):** `final_home, final_away, h1_home, h1_away`.

### Render rules (game card)
1. **Predicted score** on every card: `home_pts = (pred_total + pred_margin)/2`, `away_pts = (pred_total −
   pred_margin)/2`. This is the product — show it even when there's no bet.
2. **Conviction = color/banner**, not edge size: mammoth 🔶 (rare, ~1/wk) → high 🥇 → med 🥈 → low 🥉 →
   lean (gray) → none (plain, score only). Sort the slate by this tier, not by edge magnitude.
3. **Spread confidence may scale mildly with edge in the 4–14 band; never above 14** — `fg_spread_capped`
   games show "model off-market, no play" (accuracy collapses there).
4. Most predictions sit within ~3 pts of Vegas (credibility by design); the few visible disagreements are
   where flags fire.

---

## Table 2 — `cfb_dryrun_flags` (193 rows; ONE per fired bet signal — the picks layer)
`id, game_id, season, week, game ("Away @ Home"), source (signal name), market
(spread/total/team_total/h1_spread/h1_total/h1_ml), side, line, price (American; −110 default),
edge, conviction (mammoth/T1/T2/T3/track), tier (active|tracking), stake_units, grade_line
(open/close/soft/dk/best), mammoth (bool), **signal_key** (join key to cfb_signal_defs)`.

- **`tier='active'`** (162) = validated, surfaced as **picks**. **`tier='tracking'`** (31) = thin / track-live
  (e.g. 1H ML dog-conversion, near-breakeven total fades) → a separate "watching" section, paper-trade only.
- A single game can have **multiple flags, including opposite sides** (conflicting spots). The card's headline
  follows the model (`fg_spread_pick`) + conviction tier; the flags list shows every individual signal with its
  own side and grade line. Example (the Week-7 mammoth): Ohio State @ Illinois has 6 active flags — the
  mammoth-aligned AWAY plays (PREMIUM lay-fav, Big Ten away-fav) plus opposite HOME spots (soft-book gap,
  RvR home-dog). Model + mammoth = Ohio State; show that as the play, list the rest as context.
- `grade_line` is the routing instruction: `best` = shop books (team totals: UNDER at highest, OVER at lowest;
  1H total at best); `soft` = bet the soft book; `dk` = DraftKings number; `open`/`close` = that snapshot.
- `stake_units` is the conviction-weighted bet size (mammoth 5 → track 0.5). The validated 2025 portfolio went
  +10.2% ROI with a monotonic conviction ladder (3u tier 67%); display stake as a "units" chip.

---

## Table 3 — `cfb_teams` (137 rows; static reference, fetch once + cache)
`team_name (PK, = games.home_team/away_team), abbr (official CFBD abbreviation, e.g. OSU/SJSU/TA&M), conference,
classification (P5/FBS), color, alt_color (CFBD hex, populated for all 137), logo, logo_dark`. Logos are ESPN CDN
URLs; light+dark both present. (The full 265-team `cfb_team_mapping` table also now carries an `abbreviation` column.)

---


---

## Table 4 — `cfb_signal_defs` (31 rows; user-facing signal dictionary, fetch once + cache)
Plain-English definition for every signal so a user can **tap a signal chip and read what it means**. Join
`cfb_dryrun_flags.signal_key = cfb_signal_defs.signal_key`.
Columns: `signal_key (PK), display_name (title), market, one_liner (chip subtitle), definition (what it means),
why_it_works (the mechanism), bet_direction (how the side is chosen), typical_hit (honest validated rate),
default_conviction (T1/T2/T3/track)`.
Render: the flag chip shows `display_name` + `one_liner`; on tap, a card shows `definition`, `why_it_works`,
`bet_direction`, and `typical_hit`. Never show the raw `source` string to users — it's internal shorthand.

## App-screen mapping
- **Slate / game-card list** → `cfb_dryrun_games` (sort by `conviction_tier`; predicted score + best pick +
  flag-count chips; logos from `cfb_teams`).
- **Game detail / bet board** → `cfb_dryrun_games` row (7-market table: spread / total / team totals / 1H
  spread / 1H total / 1H ML / full ML) + `cfb_dryrun_flags` where `game_id=` (the fired signals with tiers,
  lines, book routing, grade line).
- **Picks feed** → `cfb_dryrun_flags where tier='active'` grouped by conviction; **Tracking/watch** →
  `tier='tracking'`.
- **Mammoth banner** → `cfb_dryrun_games where mammoth=true` (top of app, rare highlight).
- **Signal definition card** → on tapping any flag, look up `cfb_signal_defs` by `signal_key`.

## Known gaps / caveats (state these honestly in-product)
- **Full-game ML is display-only** for CFB — the market is efficient (ML is derived from the spread); we show
  `fg_ml_*` for context and convert spot edges to ML only as tracking (none surfaced this week).
- **Team totals / 1H need posted lines** from the event-odds archive: 55/56 Week-7 games have them (1 game
  missing TT/1H — show "no derivative markets" for it).
- **1H ML** (5 flags) and near-breakeven total-fades are **tracking-tier** — small samples; 2026 live is the
  real test.
- **Win prob** is display-only / cover-prob preferred (see §Table 1).
- **Training window:** to stay identical to the validated locked model we trained on 2016–2024 (not 2025 wks
  1–6); as-of features still run through Wk6, so there is no look-ahead — production for 2026 trains through the
  prior week automatically.
- **Week-7 validation (one week, high variance):** active picks 83/160 (52%) — spread 59%, 1H spread 58%, 1H
  total 54%, team total 47%, total a cold 40%; the mammoth (Ohio State) cashed. One week ≠ the season; the
  locked OOS portfolio is +10.2% across all of 2025.

---

## Table 5 — `cfb_dryrun_picks` (398 rows; ~7 per game — the prediction cards, all precomputed)
One row per bet type per game (ALWAYS 8 cards/game = 448 rows; every game gets a model projection for every
bet type even when no Vegas line is posted — then vegas_line/edge/best_* are null and display_only=true).
Frontend renders cards with NO math. Query
`where game_id=? order by sort_order`, group by `card_group`.
Columns: `game_id, season, week, card_group (spread|total|team_total|moneyline|h1_spread|h1_total|h1_ml),
bet_type (…|team_total_home|team_total_away), sort_order, pick_side (HOME/AWAY/OVER/UNDER), pick_team,
pick_label, model_number (our projection), model_line (our fair line), vegas_line (consensus), vegas_price,
edge (our advantage in pts), best_book, best_book_name, best_book_logo, best_line, best_odds, conviction
(mammoth|high|med|low|lean|none), recommendation (ready label: 'High Conviction'/'Solid Play'/'Lean'/'No Bet'…),
is_mammoth, stake_units, has_play, display_only, signal_keys (text[] -> cfb_signal_defs), result (validation only)`.
BEST-LINE = already computed across 11 books: spread/h1_spread = most favorable line for the side (ties→best
price); total/team_total/h1_total = Over lowest / Under highest line (ties→best price); ML/h1_ml = best price.
Team totals: BOTH home+away rows always present. UNIFIED MODEL — predicted points are full-game-derived
((pred_total ± pred_margin)/2), so they MATCH the headline score exactly (no more two-model contradiction).
Bet gates (validated ~57-62% vs posted): UNDER edge<=-3; OVER edge>=+4 P5 (>=+6 P5 = high).
Moneyline + capped spreads: `display_only=true`. Mammoth/conviction lives PER CARD (so the user sees which of
the 7 bets is the mammoth).

## Table 6 — `cfb_sportsbooks` (12 rows; static, cache)
`book_key (PK), display_name, logo_url (Clearbit), domain`. `cfb_dryrun_picks.best_book` joins here;
`best_book_logo` is also denormalized on the pick row for convenience.

## `cfb_dryrun_games.conviction_summary` (jsonb)
Array of `{card, conviction, mammoth}` for the slate pills — tells the card WHICH bet types carry plays
without loading `cfb_dryrun_picks`.

## Table 7 — `cfb_team_trends` (136 rows; per-team season-to-date trends, AS OF before Week 7)
Point-in-time (2025 weeks 1-6 only, no look-ahead). Fetch 2 rows per game (home + away team_name).
Rates (each with counts): `su_record`, `ats_w/l/p` + `ats_pct`, `ou_o/u/p` + `over_pct`, `tt_o/u` + `tt_over_pct`
(team total), `h1_ats_w/l` + `h1_ats_pct`, `h1_ou_o/u` + `h1_over_pct`, `games`, `through_week`.
Last-5 (newest first): `last5_su` ['W','L'…], `last5_ats` ['W','L','P'], `last5_ou` ['O','U','P'] -> colored chips.
`game_log` (jsonb array, newest first): per game `{week,date,opp,is_home,pts_for,pts_against,su,spread,ats,
cover_margin,total,ou,total_points,ou_margin,tt_line,tt,team_pts,h1_spread,h1_ats,h1_total,h1_ou}` -> powers the
last-5 AND the over/under graph (bar per game = `ou_margin`, +green over / -red under).
