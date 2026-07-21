# Mobile: Historical Analysis (NFL + CFB)

> How to implement the Historical Analysis feature in the app for both NFL and College Football.
> Web reference: the per-sport analytics pages were collapsed into a single unified
> `/historical-trends` page (`src/pages/HistoricalTrends.tsx`); the legacy routes `/nfl-analytics`,
> `/cfb-analytics`, and `/mlb-analytics` now redirect there. The app screen is a faithful port of
> that page. Backend is already built; the app only calls RPCs, it does not aggregate anything.

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
- `roi`: **real price-based for every market.** `fg_ml` uses historical `team_ml` (2018+); all other markets use T-60 closing prices (decimal-space median across books) from `nfl_historical_odds`, merged onto the base as `*_px` columns (2023+; pre-2023 spread/totals fall back to flat −110). Ties/pushes excluded. No market hides ROI anymore.
- Side markets return `home_away` + `fav_dog` bars; totals/team-total return an `over_under` bar.
- `by_*` lists include every group with ≥1 game in the filtered set (a game-count badge conveys
  reliability — see Breakdown behavior below).

**`*_analysis_upcoming` returns** an array of this week's games that match the same filter, only
`kickoff > now()` (empty in the offseason — show a friendly empty state, never an error):
```jsonc
[ { "team": "KC", "opponent": "BAL", "is_home": true, "is_favorite": true, "matchup": "Chiefs vs Ravens",
    "kickoff": "2026-09-06T17:00:00Z", "team_spread": -3.5, "total": 47.5, "tt_line": 24.5,
    "h1_spread": -1.5, "h1_total": 24.5 } ]   // NFL adds "referee"
```

## Filter keys (`p_filters` — every key optional; omit = no constraint)

**Common:** `season_min/max, side ('home'|'away'), spread_min/max, abs_spread_min/max,
total_min/max, tt_min/max, h1_spread_min/max, h1_abs_spread_min/max, h1_total_min/max,
ml_min/ml_max (team moneyline, American odds — negative = favorite, positive = underdog),
fav_dog ('favorite'|'underdog'), primetime (bool), temp_min/max, wind_max, team[], opponent[]`.

**The spread control (side + range) drives the spread keys, and it shows for spread AND moneyline
markets** — moneyline is the spread priced up, so `fg_ml`/`h1_ml` filter by the full-game spread:
- Direction dropdown: *Either side / Favored by / Getting*. "Favored by X–Y" → team is a favorite of
  X to Y (send `spread_min = -Y, spread_max = -X`); "Getting X–Y" → underdog of X to Y
  (`spread_min = X, spread_max = Y`); "Either side" with a range → `abs_spread_min/max`.
- **Pick'em exclusion**: when a direction is chosen, floor the low edge to 0.5 (never send a `0`
  bound). A "Favored by 0" would otherwise include pick'em (spread 0) games, which fall into the
  underdog bucket (`is_favorite = spread < 0`) and produce a contradictory "underdogs" split.
- For spread markets `fg_spread`/`h1_spread` the same control filters that market's own spread
  (`h1_spread_*` for 1H). For `fg_ml`/`h1_ml` it filters `fg_spread`.
- Because this control's Favored-by/Getting *is* the favorite/underdog choice, the separate
  **`fav_dog` dropdown is shown only for `team_total`** (which has no spread control). Totals
  (`fg_total`/`h1_total`) have neither — just the total-line range.

**Moneyline odds** control = **two numeric entry fields** (min / max American odds) under the spread
control — sliders can't hit exact prices like −102. Send `ml_min`/`ml_max` only for the fields the
user fills (one-sided is fine); the same value in both = an exact line (e.g. −102 & −102). Forgive
reversed entry by sorting when both are present. NFL ML covers 2018+; **CFB ML covers 2021+ only**
(games before have null `team_ml`).

**NFL-only:** `week_min/max`, `season_type ('regular'|'postseason')`,
`playoff_round ('Wild Card'|'Divisional'|'Conference'|'Super Bowl')`, `division (bool)`,
`day_of_week`, `dome (bool)`, `surface`, `precip ('rain'|'snow'|'none')`, `rest_min/max`,
`pre_bye (bool)`, `coach`, `referee`. Team values are abbreviations (KC, BAL).

> ⚠️ `day_of_week` must be a JSON **array** of day names (`["Fri"]`) on ALL THREE sports' RPCs —
> the SQL does `jsonb_array_elements` on it, and a scalar string errors the entire query
> ("cannot extract elements from a scalar"). This silently froze iOS MLB on stale results until
> 2026-07-20; the builders now always wrap single-day selections in an array.

**CFB-only:** `week_min/max`, `game_type ('regular'|'bowl'|'playoff'|'postseason')`,
`conference`, `conference_game (bool)`, `neutral_site (bool)`,
`ranked_matchup ('both'|'neither'|'home_ranked'|'away_ranked'|'either')` — AP Top 25 scenario:
both ranked / neither / home ranked & away unranked / away ranked & home unranked / at least one
ranked (a single dropdown; full 2016+ coverage). Team values are full school names.

## Filter grouping (how to organize the controls)

Present the controls in these labeled groups (the web rail's structure — mirror it so the two
platforms feel the same). **Weather is weather ONLY** — don't fold game-setup context (primetime,
divisional, rest) into it; that was the old "Conditions" grab-bag and it read as a junk drawer.

- **Situation** (always visible): season range, season/game-type + contextual week/round, side, the
  spread control, moneyline entry fields, total-line range, `fav_dog` (team_total only).
- **Matchup** (game setup, not weather): `primetime`, `division`, rest/bye (`rest_min/max`,
  `pre_bye`). *(NFL; CFB's analog holds `conference`, `conference_game`, `neutral_site`,
  `ranked_matchup`.)*
- **Weather**: `dome` (venue), `precip`, `temp_min/max`, `wind_max` — **nothing else**.
- **Context**: `coach`, `referee` *(NFL only — CFB has neither; use `conference` breakdown instead)*.
- **Last game**: the team's previous game — result/ATS/total/role/blowout/OT.

## The contextual week control (important UX)

Week numbers can't cleanly separate regular season from the postseason (the NFL boundary shifts
wk17→18 across years; CFB bowls/playoffs aren't week-numbered at all). So the week control is
**contextual**, not a standalone 1–22 slider:
- **NFL**: a "Season type" control (Regular + Playoffs / Regular / Playoffs). Regular → a weeks
  slider (1–18); Playoffs → a **round picker** (Wild Card / Divisional / Conference / Super Bowl);
  neither shown until a type is chosen.
- **CFB**: a "Game type" control (All / Regular / Bowl / Playoff / All postseason). Regular → a weeks
  slider (1–16); bowl/playoff/postseason → no weeks control.

## Coverage caveats

- `fg_*` markets go back deep (NFL 2018→, CFB 2016→). **`team_total` and all `h1_*` markets are
  2023–2025 only** — when one of those bet types is selected, show a "Limited history (2023+)" badge
  and clamp the season-range floor to 2023 so users can't pick an empty range.
- **CFB moneyline is 2021+** (see above); the ranked-matchup filter is full 2016+.

## Screen structure (top → bottom)

Chrome is native and background-free — no slab behind the sticky elements, no content cards:

1. **Native large title** ("NFL Trends" / "CFB Trends" / "MLB Trends") that collapses into the nav bar on scroll.
2. **Sticky filter pills** — a pinned section header with the bet-type pill (Spread · Moneyline ·
   Total · Team Total · 1H Spread · 1H ML · 1H Total; changing it refetches) plus the
   adaptive filter pills and **active-filter chips** (individual remove + "Reset all"). **Team** and
   **Opponent** are multi-select dropdowns inside Situation (football) / Teams & pitching (MLB) —
   not a page-level search bar. Pills are
   pure system Liquid Glass capsules (`liquidGlassBackground`, no custom strokes/fills; the pills
   ScrollView uses `scrollClipDisabled()` + vertical padding so glass never clips); chips are plain
   text. No slab behind any of it — content scrolls underneath.
3. **Headline summary** — plain text, no card: lead with `overall`, one big, always-meaningful
   sentence ("Home favorites covered **55.7%**, **+6.4u ROI**, over 70 games 2018–2025") + the
   coverage line + baseline. NEVER lead with an empty filtered side.
4. **Breakdowns** — plain sections separated by dividers (no containers): each `bars` dimension as
   labeled rows (side · record · hit% · ROI + a bar), then the by-team / by-conference (CFB) /
   by-coach + by-referee (NFL) / by-venue (MLB) lists (sort via a compact menu; capped at 15 rows
   behind a "Show all N" expander — CFB has 130+ FBS teams).
5. **"This week's games that match"** — plain rows from the upcoming RPC; hidden entirely when empty.

## Breakdown behavior (don't headline noise)

- **Bars** (home/away, fav/dog, over/under): show a dimension only when it's a genuine two-sided
  split — **each side ≥10% of the bar's total**. A near-empty side (e.g. a lone "underdog" inside a
  favorites-only filter, or a stray spread-vs-moneyline data mismatch) is a pinned/degenerate
  dimension; hide the whole bar rather than surface a misleading "100% (1 of 1) · +90% ROI".
- **`by_*` lists**: show every group with ≥1 game, default-sorted by game count (most-represented
  first). Each row carries a game-count badge and a thin-sample style for small n — so a small filter
  ("31 games across 27 teams") still lists all its teams instead of looking empty, without
  headlining 1-game rates.

## Sport deltas (summary)

| | NFL | CFB |
|---|---|---|
| Postseason split | `season_type` + `playoff_round` (WC/DIV/CON/SB) | `game_type` (regular/bowl/playoff/postseason) |
| Extra breakdowns | `by_coach`, `by_referee` | `by_conference` |
| Extra filters | division, day, dome, surface, precip, rest, pre-bye, coach, referee, **team[] / opponent[]** | conference, conference_game, neutral_site, ranked_matchup, **team[] / opponent[]** |
| Team key | abbreviation (KC) | full school name |
| Logos | ESPN NFL CDN by abbr | `cfb_team_mapping.logo_light` by `api` name; initials-avatar fallback |

CFB has **no referee and no per-game coach** data — drop both dimensions there.

## UX rules (port these — they were hard-won on web)

- **No scroll-jump on filter change**: keep results mounted and dim them during refetch (never
  unmount to a skeleton and back). Full skeleton only on first load.
- **Every number is unambiguous**: label each row with its side + sample size + season range.
- **Debounce** filter changes (~350 ms) so dragging/typing doesn't fire a request per tick.
- **Signed spreads** (`-3.5` = laying 3.5); keep the sign.
- Dark mode + the app's existing design system; this screen should feel native, not bolted on.

## Saved searches + sharing

Per-user saved searches live on the **main app** Supabase project (the app's auth project) — tables
`nfl_analysis_saved_filters` / `cfb_analysis_saved_filters`, own-rows RLS, ~25-per-user cap. Store
`{ name, bet_type, filters }`.

UI: a **bookmark context menu in the top-right toolbar** with the user's saved searches (tap to
restore), "Save Current Search…" (names + saves the current filter snapshot; signed-in only), and
"Share Current Search". Share opens a **bottom sheet** (`HistoricalTrendsShareView.swift`) with a
**focus picker** ("Showing: Overall / Home teams / Favorites / … / a specific team from the by-team
breakdown") that drives the infographic's headline slice. The infographic leads with a narrative
sentence built from the filters — "When it's primetime, it's snowing, and they're laying 3–10
points, home favorites covered **58%** of the time" (`narrativeClauses`/`joinedClauses` in
`HistoricalAnalysisCopy`) — then a hero hit-rate + record/ROI row, "By situation" split bar charts
with baseline ticks, and top-5 lists (teams, plus coaches on NFL / conferences on CFB; min 5 games
to qualify; a focused team outside the top 5 is appended with its true rank). Branded with the
WagerProof logo + wordmark and `wagerproof.bet` at the bottom. Export renders JUST the card via
`ImageRenderer` (scale 3, `isOpaque = false`) so the shared PNG is the standalone component on a
transparent surround, same as the agent pick tickets.

**Card styles (2026-07-20):** the sheet is a swipeable `TabView` pager (`TrendsShareStyle`) over
FIVE card designs sharing the focus picker + export path — the visible card is what exports:
1. **Full Report** — the original narrative infographic above.
2. **Poster** — one giant hit rate over a radial aura, situation as an eyebrow, record/ROI/games
   chips (chips reflow to two rows via `ViewThatFits` when the record is wide).
3. **Gauge** — donut arc of the hit rate with a white ring tick at the league baseline.
4. **Chart** — graph-first: situation splits + top-5 performers as chunky gradient bars with
   in-bar % labels and baseline ticks.
5. **Receipt** — cream-paper monospaced betting slip: active filter chips printed as ✓'d line
   items, hit% as a stamped total, decorative barcode seeded from the search.

Gauge + Chart carry **corner identity art** (`TrendsTeamArt`): when the share focus is a team OR
the filter is narrowed to exactly one team, a big faded team logo (NFL `NFLTeamAssets` / MLB
`MLBTeams` / CFB via the store's `cfbLogos` map passed into the sheet) rotates into the top-right
corner and the aura tints to the team's primary color; CFB teams without a logo get colored
initials, non-team searches get the sport ball icon. Logos are pre-fetched as `UIImage`s so
`ImageRenderer` exports include them (AsyncImage would render blank in exports).

## Definition of done

- NFL and CFB game pages each show the banner → opens the correctly-scoped Analysis screen.
- Bet-type switching + filtering updates headline, breakdowns, and upcoming list with no scroll-jump.
- Contextual week/round control behaves per sport; `team_total`/`h1_*` show the 2023+ badge + clamp.
- Spread control shows for spread AND moneyline markets; moneyline entry fields hit exact prices.
- Degenerate bars are hidden; `by_*` lists show all groups with a game-count badge.
- Offseason shows full history + a friendly empty "upcoming games" state.
- Sanity: no filters → `fg_spread` overall ≈ 50%, favorites cover ≈ 49% (not ~20/80 — that's a
  spread-sign bug).

## 2026-07-20 refresh — chat-first UI + engine parity fixes

The iOS screen was reworked into an AI-chat-first layout (all three sports):

- **Tab bar hidden** on the screen (`.toolbar(.hidden, for: .tabBar)`); a floating **liquid-glass
  chat dock** sits pinned to the bottom via `.safeAreaInset(edge: .bottom)`: a **horizontal
  suggestions row** (canned per-sport examples; flips to the user's **recent queries** while a
  query runs / when the input is focused) and a thin glass input bar with the hint "Type what
  filters you want…". Chat results surface as a **system-banner-style toast** (glass capsule
  dropping from the top, success/warning haptic, auto-dismiss ~2.4s, tap or swipe-up to dismiss —
  `TrendsChatToast` in `HistoricalAnalysisView.swift`), not a persistent status line. The old
  inline "DESCRIBE A FILTER" section (input + examples + transcript) is gone. A **black gradient
  scrim** sits behind the dock (top→bottom fade, extended through the home-indicator inset via
  `.ignoresSafeArea(edges: .bottom)`) so the glass separates from content scrolling underneath;
  the ramp tops out at 0.92 in dark mode and 0.26 in light (`chatScrimOpacity`). Because bare
  glass vanishes into that scrim, the input bar and chips pass a light white `tint` to
  `liquidGlassBackground` (`dockTint`, dark-mode only — no borders or hand-rolled containers)
  and use brighter text. While a query is in flight the send
  button is replaced by a shrunk `GlyphMatrix3x3` (dot 3 / gap 3) — the same 3×3 loader the agent
  generation card runs beside its action verbs — not a `ProgressView`.
- Recent queries persist per sport in `UserDefaults` (`ha_recent_queries_<sport>`, max 8) —
  `HistoricalAnalysisStore.loadRecentQueries()` / `recentQueries`.
- **Active filter chips** are now closeable liquid-glass capsules (tap anywhere to clear) with a
  glass "Reset all"; still rendered from `HistoricalAnalysisCopy.activeChips`, which now compares
  against `HistoricalAnalysisUISnapshot.defaults(for: sport)` instead of hardcoded NFL ranges.
- **Refetch errors surface** (`store.fetchErrorMessage` → orange banner atop the content).
  Previously a failed RPC silently kept stale results, which made broken filters read as
  "filter did nothing" (this was the reported "years filter shows all games" symptom: a scalar
  `day_of_week` errored every MLB query once a day filter was set).

Engine parity fixes shipped with it:

- MLB `day_of_week` emitted as an array (see warning above); web `HistoricalTrends.tsx` (the unified
  page that replaced `MLBAnalytics.tsx`) fixed too.
- MLB totals are cross-market: FG total bounds (5–14) emit `total_min/max` on every non-F5 market;
  the F5 total market maps the same slider to `f5_total_min/max` (2–8). Market switches reset the
  slider so F5 bounds can't leak into other markets.
- MLB NL chat round-trip now serializes/restores the MLB-only canonical dims (`months`,
  `daysOfWeek`⇄single `dayOfWeek`, `doubleheader`, `interleague`, `seriesGame`, `trip`,
  `switchGame`, `restRange`, `winLossStreak`, `lastResult`, `lastMargin`, `spHand`/`oppSpHand`,
  `windDir`, `pfRuns`) with canonical-default → iOS-sentinel guards (e.g. tempRange [30,110] must
  NOT become `temp_min=30` — that excludes dome games). `spNames`/`oppSpNames` are serialized but
  not restored (needs a name→id lookup) — chat-set pitcher filters are a known gap, as are the MLB
  as-of/systems dims (win %, RL cover %, H2H…) whose iOS UI is still the pending parity port.
- CFB `defaults(for:)` now seeds CFB-sized as-of ranges (ppg/paPg 0–60, point diff ±40, cover
  margin ±30, last margins ±80, prev wins 0–15) matching the builder's comparisons — before this,
  every CFB query shipped spurious `ppg_max`/`avg_cover_margin_*`/`last_margin_*` keys. Sheet
  sliders are sport-aware; the dead CFB "Blowout" picker was replaced by the signed margin slider.
- `nl-filter-patch` response decoding fixed: `noChange` is camelCase, and `applied[].from/to` are
  ignored (they're arbitrary JSON — decoding them as strings nulled the whole applied list and the
  UI claimed "didn't catch a filter" on successful patches).
- **Null-tolerant response decode** (same refresh): zero-row slices come back as SQL nulls
  (`bars[].options[].hit_pct`, `overall.*`, `coverage.*`, `by_team` …). The strict Swift decode
  threw for the WHOLE response on ANY side-pinning filter (side / fav_dog / team+away…), freezing
  the screen on stale results — the second half of the "filters do nothing" symptom. All response
  models now default nulls to zeros; verified against the live warehouse across 29 filter
  combinations (all 3 sports, incl. 0-result sets).
