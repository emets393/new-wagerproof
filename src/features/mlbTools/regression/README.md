# MLB Daily Regression Report (`/mlb/daily-regression-report`)

The daily MLB regression report as a split view. **Regression** here means a
team's or pitcher's recent *results* have run ahead of, or behind, the
*underlying stats* — and should swing back.

Replaces `src/pages/MLBDailyRegressionReport.tsx`, which stays on disk but is no
longer routed. The route path is unchanged.

## Layout

Mirrors `/games` and `/todays-trends`: `SplitViewLayout` with a feed on the left
and a detail pane on the right. `/mlb/daily-regression-report` is registered in
`SPLIT_VIEW_ROUTES` in `App.tsx`, without which the page would sit inside the
normal padded scroller and lose its internal scrolling.

URL state is `?game=<game_pk>`. Desktop auto-selects the first game once (a ref
guards the effect, so clicking back to the summary sticks); mobile pushes the
detail and pops on back.

## Report-wide vs per-game

The report payload is organized by *signal type*; the split view is organized by
*game*. `buildFeed.ts` inverts it, and everything that isn't about one matchup
lives in a **summary state** shown when no game is selected — reachable at any
time through the feed's pinned "Today's report" row.

| Where | Content |
|---|---|
| Summary (no `?game`) | All-time record, per-tier record, written narrative, yesterday's results, model accuracy per market + per edge band, form by weekday, form by team, methodology |
| Per game | Each suggested pick, starting-pitcher regression, team-offense regression, bullpen workload, series-position signals, starter-handedness splits, weather & park, model form for these two clubs |

Tier performance appears in *both*, deliberately but differently: the summary
compares all four tiers; a pick card shows only its own tier's record, as the
qualifier on that recommendation.

## Building the feed

Only three of the report's collections carry a `game_pk`, so games are seeded
from them and everything else is joined on by abbreviation:

| Source | Role |
|---|---|
| `suggested_picks` | Primary seed — team names, first pitch, doubleheader flags |
| `weather_park_flags` | Seeds games the pick engine passed on; supplies the venue |
| `mlb_game_signals` (series signals) | Seeds games neither of the above covers |
| pitchers / batting / bullpen / L-R splits | Team-name only — joined by canonical abbreviation |

Abbreviations come from `MLB_FALLBACK_BY_NAME`, which is stable across the
report's inconsistent naming ("Athletics" vs "Las Vegas Athletics"). The
breakdown tables use the game-log spelling instead (`AZ`, `ATH`), so team
lookups translate at the call site.

**Doubleheaders**: `game_pk` is unique per game, so picks and weather split
correctly. Team-level rows carry no `game_pk` and therefore attach to *both*
games of the day; the hero says so when `isDoubleheader` is set.

## Data hooks (reused, not rewritten)

`hooks/useRegressionData.ts` fans out the five existing hooks —
`useMLBRegressionReport`, `useMLBBucketAccuracy`,
`useMLBModelBreakdownAccuracy`, `useMLBPerfectStormRecords`,
`useMLBSeriesSignals` — plus `useF5Splits`, which is fetched only for the teams
the report's L/R section names.

## Widgets

Follow `src/features/games/detail/WIDGET_DESIGN.md`. One card answers one
question, the recommendation precedes the evidence, OVER is green + up arrow and
UNDER is blue + down arrow **on the word itself** (`PickText`), the backed team
gets full opacity with the faded side at 35%, win rates are meters with the
52.4% break-even tick, and ROI is a bar diverging from a zero center.

Each suggested pick gets **its own card** rather than sharing one — a game can
carry up to four, each with its own conviction and its own history, and stacked
in one card none of them led.

`MLBRegressionPicksForGame` (the in-game widget on `/games`) stays as-is and is
the compact version of the same content; the language matches deliberately.

## Files

```
buildFeed.ts    report payload → per-game feed, plus filter/sort/search
types.ts        the normalized model, tier metadata, market labels
hooks/          URL state (?game) and the fan-out of the five data hooks
components/     feed panel, list card, skeleton
detail/
  shared.tsx      TeamMark, PickText, TierChip, WinRateMeter, DivergingBar,
                  ThresholdMeter, RoiRow, Disclosure, GapCompare
  paging.tsx      fixed row window + HeroUI Pagination
  sections/       PickSections · RegressionSections · ContextSections ·
                  SummarySections
```

## Known differences from the legacy page

- The legacy page rendered every collection as a flat list of tables for the
  whole slate. Here they are filtered to the selected game; the only always-full
  lists are the report-wide accuracy tables in the summary.
- Series signals now seed the feed, so a game the report's ETL missed still
  appears. The legacy page listed those signals but had no game context for them.
- Nothing renders `perfect_storm_matchups` or `cumulative_record` — the former
  was already unused by the legacy page, and the latter double-counts untiered
  picks. The all-time record is summed from the four tier records instead, which
  is what the legacy recap header already did.
- The `type` argument to the legacy pitcher `renderTable` was never used; the
  direction is now a real field on the row (`RegressionPitcher.direction`).

## Overlap with `../shared/`

`src/features/mlbTools/shared/` (built for `/mlb/f5-splits` and
`/mlb/pitcher-matchups`) has a generic feed panel, list card and paging helper.
This tool keeps its own because it needs a filter control, a sort menu and the
pinned summary row that the shared panel does not model. Consolidating is a
reasonable follow-up once both shapes have settled.
