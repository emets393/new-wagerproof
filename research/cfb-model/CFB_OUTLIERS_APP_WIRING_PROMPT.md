# Cursor prompt — wire CFB Outliers **Trends** (team + coach) into the app

We just built the CFB data layer for the Outliers **Trends** page. It mirrors the NFL trend tables
**byte-for-byte** (same jsonb shapes), so wherever you build/own the NFL trends rendering, CFB should
reuse the exact same components and types — only the data source (CFB tables) and a couple of labels
differ. CFB has **TEAMS + COACHES only** (no referee / player-prop trends — that data doesn't exist).

Supabase project = the existing data project the app already reads (`jpxnjuwglavsjbgbasnl`). All tables
are public-read (RLS select = true). **Do not touch the Python/model code** — this is app-side only.

---

## 1. Data that's now available

### `cfb_team_trends` (one row per team, keyed `team_name`, `season`, `through_week`)
Already had overall season records + `last5_*` arrays + `game_log`. **Two new jsonb columns:**

- **`splits`** = `{ market: { dim: { window: { h, l, p, n, pct } } } }`
  - markets (6): `spread`, `moneyline`, `total`, `team_total`, `h1_spread`, `h1_total`
  - dims (5): `overall`, `home`, `away`, `favorite`, `underdog`
  - windows: `"3"`, `"5"`, `"7"` (last-N games, season-scoped)
  - `pct` is **0–1** (e.g. `0.6`) — multiply by 100 for display. `n` = decided games (h+l, excludes pushes `p`).
- **`matchups`** = `{ opponent_team_name: { meetings, spread:{h,n,pct}, moneyline:{h,n,pct}, total:{h,n,pct} } }`
  - cross-season, last ~6 head-to-head meetings, FG markets only.

> ⚠️ The legacy flat columns (`ats_pct`, `over_pct`, `tt_over_pct`, `h1_ats_pct`, `h1_over_pct`) are
> **×100 already** (e.g. `57.1`). The new `splits`/`matchups` `pct` fields are **0–1**. Don't double-scale.

### `cfb_coach_trends` (NEW table — one row per head coach, keyed `coach`, `through_season`, `through_week`)
- `coach`, `current_team`, `career_games`, `first_season`, `last_season`
- **`splits`** = same shape as team splits, but:
  - **6 markets**, windows **`"5"`, `"10"`, `"15"`**, and **9 dims**:
    `overall`, `home`, `away`, `favorite`, `underdog`, `division`, `non_division`, `primetime`, `regular`
- **`matchups`** = `{ opponent_team_name: { meetings, <all 6 markets>:{h,n,pct} } }` — coach's **career** record vs each opponent.
- **`market_coverage`** = `{ market: "2016-2025" | "2023-2025" }` — FG markets (spread/ml/total) go back to 2016;
  derivatives (team_total / h1_spread / h1_total) only **2023–2025**.
- `recent_game_log` = last 15 games (newest-first) if you want a recent-form strip.

---

## 2. CFB-specific labeling (only difference from NFL)

1. **`division` → "Conference", `non_division` → "Non-conference."** In CFB "division" means a conference
   game (the data uses the literal `division`/`non_division` keys so the code path is shared — just
   relabel them in the UI when `sport === 'cfb'`).
2. **Limited-history note on coaches.** When a coach split/matchup is a derivative market
   (`team_total`/`h1_spread`/`h1_total`), read `market_coverage[market]`; if it's `"2023-2025"`, show a
   small muted note like "since 2023" so users know the sample is shorter than the FG markets.
3. **Hide empty cells.** Any split window with `n === 0` (or matchup market with `n === 0`) should render
   as "—", not "0%". Early-season teams legitimately have tiny samples.
4. `pct` 0–1 → render `Math.round(pct * 100)`%; show the raw `h-l` (and `p` if > 0) as the sample.
5. CFB team helpers already exist: `getCFBTeamLogo`, `getCFBTeamColors`, `getCFBTeamInitials`
   (`utils/teamColors.ts`). Coach rows have no logo — use `current_team`'s logo as the coach avatar.

---

## 3. THE UX CHANGE — CFB matchup picker (this is the main ask)

Today the Outliers trends section uses a **horizontal `ScrollView` of `OutlierMatchupCard`s** to pick a
matchup (see `app/(drawer)/(tabs)/outliers/index.tsx`, the `styles.hubScrollBreakout` /
`styles.hubCardRow` blocks). That works for NFL (~16 games) but CFB has **50+ games a week** — endlessly
scrolling cards is bad.

**For `sport === 'cfb'` ONLY**, replace the horizontal card scroller with a **dropdown picker**:

- A single full-width button, e.g. **"Select matchup ▾"** (show the currently-selected matchup once one
  is picked: away logo + abbr `@` home logo + abbr).
- Tapping it opens a `Modal` / bottom sheet with a **scrollable list of every game this week**, one row per
  game: `[away logo] AWAY @ [home logo] HOME` (use full names or abbrs + logos), tappable.
- Include a **search `TextInput`** at the top of the list to filter by team name (there are a lot of games).
- Selecting a row sets the active matchup and renders the two teams' trend content below (team splits +
  matchups + both head coaches) — identical to what tapping a card does today.
- **All other sports keep the existing horizontal `OutlierMatchupCard` scroller.** Branch on sport; don't
  remove the scroller for NFL/NBA/NCAAB/MLB.

The week's CFB games come from the same slate the page already loads: `fetchWeekGames()` in
`services/outliersService.ts` returns `GameSummary[]` with `sport: 'cfb'` rows (filter to cfb). Each
`GameSummary` has `awayTeam`/`homeTeam` you can pass to `getCFBTeamLogo`/`getCFBTeamInitials`. Join the
selected game's two team names to `cfb_team_trends.team_name` and the two coaches via
`cfb_coach_trends.current_team` (the HC whose `current_team` === that team, greatest `last_season` if a tie).

---

## 4. What each selected matchup should show (mirror NFL)

For the two teams in the chosen game:
- **Team trend cards** — per market (spread/ml/total/team_total/1H spread/1H total), a small grid of the
  `splits` dims (overall + home/away + fav/dog) across the 3 windows (L3 / L5 / L7). Same component NFL uses.
- **Head-to-head** — `cfb_team_trends.matchups[opponent]` for this exact opponent (meetings + spread/ml/total).
- **Coach trends** — each team's current head coach from `cfb_coach_trends`: career splits (9 dims, windows
  5/10/15) with the Conference/Non-conference + primetime/regular dims, plus the coach's career H2H vs the
  opponent (`matchups[opponent]`), with the limited-history note on derivative markets.

If the NFL trends UI already exists, render CFB through the same components/types and just pass the CFB data
+ sport flag. If it doesn't exist yet, build it once, generically (keyed off a `sport` prop), so NFL can
drop in later — the table shapes are identical.

---

## 5. Files to touch (suggested)
- `app/(drawer)/(tabs)/outliers/index.tsx` — add the CFB matchup-picker branch; fetch CFB trends.
- `services/outliersService.ts` (or a new `cfbTrendsService.ts`) — `fetchCFBTeamTrends(season, throughWeek)`
  and `fetchCFBCoachTrends(throughSeason, throughWeek)` (simple PostgREST selects).
- `types/cfbTrends.ts` — `CFBTeamTrends`, `CFBCoachTrends`, and the shared `Splits`/`Matchups` shapes
  (reuse the NFL types if they exist).
- A `CFBMatchupPicker` component (button + searchable modal list) used only when `sport === 'cfb'`.

## 6. Acceptance
- CFB Outliers shows a **"Select matchup"** dropdown (not a horizontal scroller); other sports unchanged.
- Picking a game shows both teams' split grids, their H2H, and both head coaches' career trends.
- `division`/`non_division` render as **Conference/Non-conference**; derivative coach markets show the
  "since 2023" note; empty samples render "—"; percentages are correct (splits/matchups ×100, flat
  `*_pct` columns used as-is).
- No model/Python files changed.
