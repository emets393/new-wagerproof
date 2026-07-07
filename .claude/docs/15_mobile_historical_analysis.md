# Mobile: Historical Analysis (NFL + CFB)

> How to implement the Historical Analysis feature in the app for both NFL and College Football.
> The web pages are live at `/nfl-analytics` (`src/pages/NFLAnalytics.tsx`) and `/cfb-analytics`
> (`src/pages/CFBAnalytics.tsx`) — the app screen is a faithful port of those. Backend is already
> built; the app only calls RPCs, it does not aggregate anything.

## What it is

"For any betting market (full-game spread / moneyline / total, team total, 1st-half spread / ML /
total), show how it has performed across years of games — sliceable by dozens of situational
filters — and list this week's upcoming games that fit the same filter." One screen, two sports.

## Entry point — a banner, no menu item

There is **no tab or menu entry**. The only way in is a **banner at the top of the NFL game page
and the CFB game page** (the existing per-sport game screens): a slim card, e.g. "📊 Historical
Trends — see how any bet type has performed" with a chevron. Tapping it opens the Analysis screen
**scoped to that sport** (NFL banner → NFL RPCs, CFB banner → CFB RPCs), defaulting to `fg_spread`
with no filters (which shows the clean full-history headline immediately).

## Backend — two RPCs per sport (already live)

On the **warehouse / college-football Supabase project** (`jpxnjuwglavsjbgbasnl`), public-read via
the anon key — the same project the app already uses for CFB inputs and the dry-run tables. Call the
RPCs; do not build data.

- NFL: `nfl_analysis(p_bet_type, p_filters)` + `nfl_analysis_upcoming(p_bet_type, p_filters)`
- CFB: `cfb_analysis(p_bet_type, p_filters)` + `cfb_analysis_upcoming(p_bet_type, p_filters)`

**`*_analysis` returns:**
```jsonc
{
  "bet_type": "fg_spread",
  "coverage":  { "season_min": 2018, "season_max": 2025, "n_bets": 4172, "n_games": 2086 },
  "baseline_pct": 50.0,                                   // league-wide rate, for context
  "overall":   { "n": 4172, "wins": 2086, "hit_pct": 50.0, "roi": -4.6 },  // LEAD WITH THIS
  "bars": [ { "dimension": "home_away", "options": [ { "side": "home", "n": ..., "hit_pct": ..., "roi": ... }, ... ] },
            { "dimension": "fav_dog",   "options": [ ... ] } ],
  "by_team":       [ { "team": "KC",  "n": 70, "hit_pct": 55.7, "roi": 6.4 }, ... ],
  "by_coach":      [ ... ],   // NFL only
  "by_referee":    [ ... ],   // NFL only
  "by_conference": [ ... ]    // CFB only
}
```
- **Bet types**: `fg_spread, fg_ml, fg_total, team_total, h1_spread, h1_ml, h1_total`.
- `roi` is `(hit_pct/100*1.909 - 1)*100`; **null for moneyline** (`fg_ml`, `h1_ml`) — show record only.
- Side markets return `home_away` + `fav_dog` bars; totals/team-total return an `over_under` bar.

**`*_analysis_upcoming` returns** an array of this week's games that match the same filter, only
`kickoff > now()` (empty in the offseason — show a friendly empty state, never an error):
```jsonc
[ { "team": "KC", "opponent": "BAL", "is_home": true, "is_favorite": true, "matchup": "Chiefs vs Ravens",
    "kickoff": "2026-09-06T17:00:00Z", "team_spread": -3.5, "total": 47.5, "tt_line": 24.5,
    "h1_spread": -1.5, "h1_total": 24.5 } ]   // NFL adds "referee"
```

## Filter keys (`p_filters` — every key optional; omit = no constraint)

**Common:** `season_min/max, side ('home'|'away'), fav_dog ('favorite'|'underdog'),
spread_min/max, abs_spread_min/max, total_min/max, tt_min/max, h1_spread_min/max,
h1_abs_spread_min/max, h1_total_min/max, ml_min/ml_max (team moneyline, American odds — negative =
favorite, positive = underdog), primetime (bool), temp_min/max, wind_max, team[], opponent[]`.
The moneyline control is **two numeric entry fields** (min / max American odds) under the spread
control — sliders can't hit exact prices like −102. Send `ml_min`/`ml_max` only for the fields the
user fills (one-sided is fine); the same value in both = an exact line (e.g. −102 & −102). Forgive
reversed entry by sorting when both are present. NFL ML covers 2018+; **CFB ML covers 2021+ only**
(games before have null `team_ml`).

**NFL-only:** `week_min/max`, `season_type ('regular'|'postseason')`,
`playoff_round ('Wild Card'|'Divisional'|'Conference'|'Super Bowl')`, `division (bool)`,
`day_of_week`, `dome (bool)`, `surface`, `precip ('rain'|'snow'|'none')`, `rest_min/max`,
`pre_bye (bool)`, `coach`, `referee`. Team values are abbreviations (KC, BAL).

**CFB-only:** `week_min/max`, `game_type ('regular'|'bowl'|'playoff'|'postseason')`,
`conference`, `conference_game (bool)`, `neutral_site (bool)`,
`ranked_matchup ('both'|'neither'|'home_ranked'|'away_ranked'|'either')` — AP Top 25 scenario:
both ranked / neither / home ranked & away unranked / away ranked & home unranked / at least one
ranked (a single dropdown; full 2016+ coverage). Team values are full school names.

## The contextual week control (important UX)

Week numbers can't cleanly separate regular season from the postseason (the NFL boundary shifts
wk17→18 across years; CFB bowls/playoffs aren't week-numbered at all). So the week control is
**contextual**, not a standalone 1–22 slider:
- **NFL**: a "Season type" control (Regular + Playoffs / Regular / Playoffs). Regular → a weeks
  slider (1–18); Playoffs → a **round picker** (Wild Card / Divisional / Conference / Super Bowl);
  neither shown until a type is chosen.
- **CFB**: a "Game type" control (All / Regular / Bowl / Playoff / All postseason). Regular → a weeks
  slider (1–16); bowl/playoff/postseason → no weeks control.

## Coverage caveats (both sports)

`fg_*` markets go back deep (NFL 2018→, CFB 2016→). **`team_total` and all `h1_*` markets are
2023–2025 only** — when one of those bet types is selected, show a "Limited history (2023+)" badge
and clamp the season-range floor to 2023 so users can't pick an empty range.

## Screen structure (top → bottom)

1. **Bet-type selector** (segmented / pills): Spread · Moneyline · Total · Team Total · 1H Spread ·
   1H ML · 1H Total. Changing it refetches.
2. **Headline card** — lead with `overall`: one big, always-meaningful sentence ("Home favorites
   covered **55.7%**, **+6.4u ROI**, over 70 games 2018–2025") + the coverage line + baseline.
   NEVER lead with an empty filtered side.
3. **Filters** — adaptive to the bet type; the contextual week/round control above; **active-filter
   chips** with individual remove + "Reset all".
4. **Breakdowns** — each `bars` dimension as labeled rows (side · record · hit% · ROI + a bar), then
   the by-team / by-conference (CFB) / by-coach + by-referee (NFL) lists (sortable, collapsible).
5. **"This week's games that match"** — cards from the upcoming RPC; hidden entirely when empty.

## Sport deltas (summary)

| | NFL | CFB |
|---|---|---|
| Postseason split | `season_type` + `playoff_round` (WC/DIV/CON/SB) | `game_type` (regular/bowl/playoff/postseason) |
| Extra breakdowns | `by_coach`, `by_referee` | `by_conference` |
| Extra filters | division, day, dome, surface, precip, rest, pre-bye, coach, referee | conference, conference_game, neutral_site |
| Team key | abbreviation (KC) | full school name |
| Logos | ESPN NFL CDN by abbr | `cfb_team_mapping.logo_light` by `api` name; initials-avatar fallback |

CFB has **no referee and no per-game coach** data — drop both dimensions there.

## UX rules (port these — they were hard-won on web)

- **No scroll-jump on filter change**: keep results mounted and dim them during refetch (never
  unmount to a skeleton and back). Full skeleton only on first load.
- **Every number is unambiguous**: label each row with its side + sample size + season range.
- **Debounce** slider changes (~350 ms) so dragging doesn't fire a request per tick.
- **Signed spreads** (`-3.5` = laying 3.5); keep the sign.
- Dark mode + the app's existing design system; this screen should feel native, not bolted on.

## Saved filters

Per-user, on the **main app** Supabase project (the app's auth project) — tables
`nfl_analysis_saved_filters` / `cfb_analysis_saved_filters`, own-rows RLS, ~25-per-user cap. Store
`{ name, bet_type, filters }`; let the user name/save the current view and reload it.

## Definition of done

- NFL and CFB game pages each show the banner → opens the correctly-scoped Analysis screen.
- Bet-type switching + filtering updates headline, breakdowns, and upcoming list with no scroll-jump.
- Contextual week/round control behaves per sport; `team_total`/`h1_*` show the 2023+ badge + clamp.
- Offseason shows full history + a friendly empty "upcoming games" state.
- Sanity: no filters → `fg_spread` overall ≈ 50%, favorites cover ≈ 49% (not ~20/80 — that's a
  spread-sign bug).
