# Outliers Trends (web)

Web port of the iOS "Outliers Trends" experience, rebuilt into a Linemate-style
dashboard: a vertical stack of titled bands over today's NFL, NCAAF, and MLB
slates. Mounted on the Today's Outliers page (`src/pages/TodayInSports.tsx`,
route `/today-in-sports`).

Band order (see `OutliersDashboard`):

1. **Filter pills** — sport / subject / matchup.
2. **Today's Matchups** — logo-tile grid of the slate, deep-linking into
   `/games`. Always the first band; it's the page's anchor.
3. **Parlay God** — MLB-only, Pro-gated. Perfect-streak team parlays from the
   slate, one themed 3–5 leg ticket per category.
4. **Props Cheats** — MLB-only, Pro-gated. Same card language, player-prop legs.
5. **Per-market trend carousels** — the restyled trend cards, unchanged pipeline.

The two premium bands are **hidden** (not placeholder-locked) when MLB is out of
scope — the engine only builds MLB legs this phase. NBA/NCAAB alone still render
the "coming soon" card.

## All Sports mode

Sport and matchup are **multi-select** (`MultiFilterPill`). An empty selection
means "everything" — there is no `'all'` sentinel to keep in sync, and clearing
a filter is just `[]`. By default both are empty, so every band fans out across
the three sports with a live trends source (`OUTLIERS_TRENDS_SPORTS` = NFL,
NCAAF, MLB). Mechanics:

- `useOutliersTrendsMulti` runs one query per sport, each its own cache entry,
  so narrowing the pill is instant — the data is already there.
  Partial failure is tolerated — one dead slate doesn't blank the others.
- Each slate is filtered on its own terms (the subject/betting-line rules are
  sport-specific), then the results are **merged and re-sorted** so a market rail
  is best-first across every sport.
- Merged cards are tagged `sport` (`OutliersSportedCard`); games are keyed by the
  sport-qualified `matchupKey(sport, id)` because raw game ids aren't unique
  across slates. The matchup pill's values are those same qualified keys, and
  `matchupIdsForSport()` narrows the selection to one slate's raw ids — it
  returns `null` for "no filter", distinct from an empty set meaning "games were
  picked but none are this sport's".
- Selecting only sports without a trends source (NBA/NCAAB) yields no active
  sports, which renders the "coming soon" card.
- The subject pill shows the **union** of subjects across the active sports; a
  subject one sport lacks simply contributes no cards from it.
- Matchup tiles are ordered by start time across all sports and tagged with a
  league label only when more than one sport is on screen.

iOS sources of truth live in `wagerproof-ios-native/`
(`OutliersTrendsView.swift`, `OutliersTrendCard.swift`, `NFLTrendsEngine.swift`,
`MLBTrendsEngine.swift`, `OutliersTrendsStore.swift`, `ParlayGodRail.swift`);
each file here names the Swift file it ports.

## Data flow

- **NFL / NCAAF**: slate anchor (latest season+week from
  `nfl_dryrun_games` / `cfb_dryrun_games`) → server-pre-rendered cards from
  `nfl_outliers_trend_cards` / `cfb_outliers_trend_cards`.
- **MLB trends**: today's slate bundle (`mlb_games_today`,
  `mlb_signal_features_pregame`, `mlb_odds_snapshots`, `mlb_team_mapping`,
  `mlb_team_trends`) → cards built client-side by `mlbTrendsEngine.ts`.
- **Parlay God / Props Cheats**: the same MLB bundle + the player-props slate,
  assembled into tickets by the **`@/features/parlayGod`** engine (see that
  module's README). The dashboard consumes `useParlayGod(sports.includes('mlb'))`
  and `ProGate` from there — no engine logic lives in this module.
- **NBA / NCAAB**: no trends source yet — renders a "coming soon" card, no fetch.

All tables live on the CFB (sports-data) Supabase project via
`collegeFootballSupabase`.

## Files

| File | Purpose |
|------|---------|
| `types.ts` | Models: sport filter/subjects, slate game, card/row/betting-line, market section, MLB trend splits |
| `outliersTrendsService.ts` | Supabase fetchers (NFL/NCAAF slates + cards, MLB bundle) |
| `mlbTrendsEngine.ts` | TS port of the iOS MLBTrendsEngine (client-side MLB card building) |
| `filtering.ts` | Filter pipeline (slate scope → subject → line → matchup → sort), qualified matchup keys, market-section bucketing (cap 24) |
| `teamVisuals.ts` | Shared team logo/colors/initials resolver (trend cards + matchup tiles) |
| `hooks/useOutliersTrends.ts` | `useOutliersTrendsMulti(sports)` — one React Query entry per sport (`['outliers-trends', sport]` → `{ games, cards }`), combined |
| `hooks/useHorizontalRail.ts` | Rail scroll controller (overflow/edge state + stepped scrolling) shared by a band's header and its rail |
| `components/OutliersDashboard.tsx` | Dashboard shell: filter pills + all bands, hoisted filter state, cross-sport merge, loading/empty/error/coming-soon |
| `components/SectionHeader.tsx` | Reusable band header: title + inline dropdown selector + right affordance (link / hover-reveal chevrons) |
| `components/ParlayRailSection.tsx` | Shared Parlay God / Props Cheats band (+ the two presets); category quick-filter + Pro gate |
| `components/ParlayTicketCard.tsx` | Parlay ticket card (compact rail + expanded dialog) — port of `ParlayGodCard.swift` |
| `components/ParlayTicketCardSkeleton.tsx` | Ticket-card shimmer |
| `components/TodaysMatchupsGrid.tsx` | Logo-tile grid across the active sports (MLB self-fetches; NFL/NCAAF reuse the dashboard's slates) |
| `components/MatchupTile.tsx` | One matchup tile → `/games` deep link; team-colored edge glows |
| `components/OutliersTrendCard.tsx` | Fixed 300×240 trend card (top-right odds chip); click opens the breakdown dialog |
| `components/OutliersTrendCardSkeleton.tsx` | Matching trend-card shimmer |
| `components/HorizontalCardRail.tsx` | Edge-to-edge snap rail + edge-fade gradients. All rail cards are 300px wide (`SCROLL_STEP_PX` coupling) |

## Rail scroll model

Vertical page scrolling always wins: the rail **never** intercepts the wheel and
sets no `touch-action`, so a vertical gesture over a rail scrolls the page and
only a horizontal one pans the rail.

Horizontal movement on desktop is the `‹ ›` pair, which lives **right-aligned in
the band's `SectionHeader`** — not floating over the cards — and fades in on
hover/focus of the band (`revealOnHover`, which needs `group` on the section
wrapper). Because nothing overlays the cards, the rail runs flush to both edges
of the container with no inset.

Edge fades are painted with the real page background (`--background` in light,
the layout's black `SidebarInset` in dark) and fade to a transparent stop of the
*same hue* — plain `transparent` fades through `rgba(0,0,0,0)` and reads gray.
If the page background ever changes, update those two gradients to match.

## Usage

```tsx
import { OutliersDashboard } from '@/features/outliers/components/OutliersDashboard';

<OutliersDashboard />
```

The dashboard owns its own filter state (defaults: every sport / All subjects /
every game — all three empty selections). Changing sports resets the matchup
selection (its options are scoped to the sports on screen) and coerces subject
when the new scope doesn't allow it (MLB alone is teams-only; NCAAF has no
refs/players). Card
dimensions are fixed at **300×240** (trend) /
**300×244** (ticket) in three coupled places — the card, its skeleton, and the
rail's `SCROLL_STEP_PX`; keep them in sync if a card is resized.

## Access model

The page keeps its full-page `useFreemiumAccess` hard lock (`TodayInSports.tsx`).
Parlay God / Props Cheats additionally wrap their content in `ProGate`
(blur + tap-to-unlock → `/access-denied`) for iOS parity. `ProGate` passes
through for Pro users **and admins**, so admins always see both rails
unblurred. Today only paid users reach the dashboard, so the blur path is
exercised only if that page gate is later relaxed.
