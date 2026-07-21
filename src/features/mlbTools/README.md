# MLB per-game tools (split views)

The MLB tool pages that answer a question **about one game at a time**, rebuilt
as `SplitViewLayout` split views: left = today's MLB slate, right = that game's
breakdown. Same shell and interaction model as `/games` and `/todays-trends`.

| Route | Folder | Answers |
|---|---|---|
| `/mlb/f5-splits` | `f5Splits/` | How do these two clubs do through five innings in tonight's exact split? |
| `/mlb/pitcher-matchups` | `pitcherMatchups/` | Which posted player prop in this game is worth a look? |

Both routes are registered in `SPLIT_VIEW_ROUTES` in `App.tsx`, without which
the page would sit inside the normal padded scroller and lose its internal
scrolling. URL state is `?game=<game_pk>` — desktop auto-selects the first game
(with `replace`, so Back doesn't bounce through it) and mobile pushes so the
back button pops the detail.

The old page files (`src/pages/mlb/F5Splits.tsx`,
`src/pages/mlb/PitcherMatchups.tsx`) and their card components
(`src/components/mlb/F5SplitsGameCard.tsx`,
`src/components/mlb/pitcher-matchups/PropMatchupBlock.tsx`) stay on disk but are
no longer routed.

## Data layer

Unchanged — every hook is reused verbatim, only the presentation is new.

| Tool | Hooks |
|---|---|
| F5 Splits | `useTodaysMlbGames`, `useF5Splits` |
| Prop Matchups | `useTodaysMatchupGames`, `useAllMatchupData`, `useAllPlayerProps`, `useParksMap` |

`shared/` holds everything both tools use: the normalized feed item
(`types.ts`), team branding (`teams.ts`), URL state, search/date grouping
(`feedUtils.ts`), the feed panel + list card + skeleton, the detail shell, and
the widget primitives (`visuals.tsx`, `paging.tsx`).

`shared/MlbToolDetailShell.tsx` imports `useMasonryGrid` from
`@/features/games/detail/` — the packing rule is identical and the hook is
sport-agnostic, so it isn't duplicated.

## The reads each tool derives

The legacy pages printed every number and left the conclusion to the reader.
Both tools now lead with a call, in `<tool>/model.ts`:

**F5 Splits** — offense splits key off the *opposing* starter's hand, defense
splits off the club's *own* starter. Two reads:

- **Side**: higher first-five win rate in the split wins; `null` on a tie or
  when either club is under the display minimum (2 games).
- **Total**: `away avg F5 runs + home avg F5 runs` vs the posted first-five
  total. The gap's sign *is* the direction, so the arrow can never contradict
  the number beside it (WIDGET_DESIGN rule 10).

**Prop Matchups** — one play per player (their strongest posted market, via the
existing `pickHeadlineProp`), ranked by `last-10 clear rate − break-even implied
by the posted over price`. Plays with fewer than 5 recent games sort last rather
than being dropped, so the row still says the line exists.

## Widgets

Follow `src/features/games/detail/WIDGET_DESIGN.md`. One card answers one
question, the recommendation comes before the evidence, OVER is green + up arrow
and UNDER is blue + down arrow on the word itself, the favored side gets a check
with the other dimmed to ~35%, and comparisons are divided or diverging bars
rather than stat sentences.

| Card | Tool | Shows |
|---|---|---|
| First-five side | F5 | Win-rate lean, both clubs' rates as one opposed bar in team colors, F5 moneylines, records behind a disclosure |
| First-five total | F5 | Split projection vs posted line with the gap called out, plus the combined over rate against a 50% line |
| Tonight's starters | F5 | The two arms every other card is conditioned on, venue and both totals |
| First-five offense | F5 | Runs scored in the split vs the club's own season baseline, as diverging bars |
| First-five defense | F5 | Runs allowed behind tonight's starter hand — colors inverted, fewer is better |
| Top prop play | Props | The best posted line, with its clear rate metered against the price's break-even |
| Starting pitchers | Props | Both starters, hand, archetype, and their anchor prop with a last-10 strip |
| Starter arsenal | Props | Top three pitches by usage with velo and whiff rate, one starter at a time |
| Ballpark & conditions | Props | HR factor by batter hand vs a neutral park, roof, wind and temperature |
| Batter props | Props | Every posted batter line for one lineup, paged 5 at a time |

Cards whose two scopes are the same question (away/home lineup, away/home
starter) share one card behind a `SegmentedControl` in the header accessory
rather than stacking as two identical tables.

## Known differences from the legacy pages

- **Fixed a real bug in the port.** `PitcherMatchups.tsx` passed
  `benchmarksR` (league batting vs RHP) to the away lineup and `benchmarksL`
  (vs LHP) to the home lineup unconditionally. The correct key is the *opposing*
  starter's hand, so the home lineup was always graded against vs-LHP baselines
  no matter who was actually starting. The split view doesn't render the
  percentile-shaded stat accordions those benchmarks fed, so it drops
  `useLeagueBenchmarks` entirely rather than carrying the bug forward. Anything
  restoring those accordions must key the benchmark on
  `game.home_sp_hand` for the away lineup and `game.away_sp_hand` for the home
  lineup.
- The F5 page gated its "season avg runs allowed" row on the *offense* split's
  game count, which is a different sample from the one the row describes. The
  season baseline is sample-independent here, so it is shown whenever it exists.
- The season-average and record rows are gated consistently on
  `hasEnoughSplitGames`; the legacy card checked only that the row existed for
  some cells and the game count for others.
- Per-batter drilldowns (pitch-type splits, batted-ball profiles, the
  season/pitcher stat accordions) are not ported. The pitch mix that fed them
  survives as the Starter arsenal card.
- Both pages' cross-links to `/mlb/picks-report` and `/mlb/picks-performance`
  moved out of the page header; those routes are unchanged and still reachable
  from the sidebar.
