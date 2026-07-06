# Outliers Trends (web)

Web port of the iOS "Outliers Trends" experience: situational betting trend
cards (teams / coaches / refs / players) for the current NFL, NCAAF, and MLB
slates, grouped into per-market horizontal carousels. Mounted on the
Today in Sports page (`src/pages/TodayInSports.tsx`, "Trend Outliers" block
inside the Value Summary card), replacing the old NBA/NCAAB situational
trend-outlier grids.

iOS sources of truth live in
`wagerproof-ios-native/` (`OutliersTrendsView.swift`, `OutliersTrendCard.swift`,
`NFLTrendsEngine.swift`, `MLBTrendsEngine.swift`, `OutliersTrendsStore.swift`);
each file here names the Swift file it ports.

## Data flow

- **NFL / NCAAF**: slate anchor (latest season+week from
  `nfl_dryrun_games` / `cfb_dryrun_games`) → server-pre-rendered cards from
  `nfl_outliers_trend_cards` / `cfb_outliers_trend_cards`.
- **MLB**: today's slate bundle (`mlb_games_today`, `mlb_signal_features_pregame`,
  `mlb_odds_snapshots`, `mlb_team_mapping`, `mlb_team_trends`) → cards built
  client-side by `mlbTrendsEngine.ts`.
- **NBA / NCAAB**: no trends source yet — renders a "coming soon" card, no fetch.

All tables live on the CFB (sports-data) Supabase project via
`collegeFootballSupabase`.

## Files

| File | Purpose |
|------|---------|
| `types.ts` | Models: sports/subjects, slate game, card/row/betting-line, market section |
| `outliersTrendsService.ts` | Supabase fetchers (NFL/NCAAF slates + cards, MLB bundle) |
| `mlbTrendsEngine.ts` | TS port of the iOS MLBTrendsEngine (client-side MLB card building) |
| `filtering.ts` | Filter pipeline (slate scope → subject → displayable line → matchup → sort) + market-section bucketing (cap 24, player-overflow dropped) |
| `hooks/useOutliersTrends.ts` | React Query hook keyed `['outliers-trends', sport]` → `{ games, cards }` |
| `components/OutliersTrendsSection.tsx` | Self-contained section: filter pills (sport/subject/matchup) + market carousels + loading/empty/error/coming-soon states |
| `components/OutliersTrendCard.tsx` | Fixed 300x240 compact card; click opens a dialog with the full breakdown |
| `components/OutliersTrendCardSkeleton.tsx` | Matching shimmer skeleton (iOS-style `.ios-skeleton` primitives) |

## Usage

```tsx
import { OutliersTrendsSection } from '@/features/outliers/components/OutliersTrendsSection';

<OutliersTrendsSection />
```

The section owns its own filter state (defaults: NFL / All subjects / All
games). Sport switches reset matchup and coerce subject (MLB is teams-only;
NCAAF has no refs/players).
