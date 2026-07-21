# Sports & Predictions

> Last verified: March 2026

## Overview

WagerProof provides game predictions, live scores, and betting analytics for five major sports: NFL, CFB (College Football), NBA, NCAAB (College Basketball), and MLB.

---

## Architecture Comparison

| Feature | Web | Mobile |
|---------|-----|--------|
| **Sports Pages** | Separate page per sport | Unified Feed with sport tabs |
| **Game Details** | Modal dialogs | Bottom sheets |
| **Live Scores** | Marquee ticker | Full Scoreboard tab (8 leagues) |
| **Polymarket** | Widget on pages | Widget + Feed integration |
| **Caching** | sessionStorage + React Query | In-memory per-sport cache |

---

## Database Tables (Verified)

| Sport | Input Data | Predictions |
|-------|------------|-------------|
| **NFL** | `v_input_values_with_epa` | `nfl_predictions_epa` |
| **CFB** | `cfb_dryrun_games` | `cfb_dryrun_picks` |
| **NBA** | `nba_input_values_view` | `nba_predictions` |
| **NCAAB** | `v_cbb_input_values` | `ncaab_predictions` |

### Additional Tables
- `cfb_teams` - CFB team abbreviations, logos, colors, and conference metadata
- `cfb_signal_defs` - Plain-English definitions for CFB supporting signal pills
- `cfb_sportsbooks` - CFB sportsbook display names/logos for best-line rows
- `production_weather` - Weather for NFL
- `live_scores` - Real-time scores
- `polymarket_markets` / `polymarket_events` - Polymarket cache

---

## Web Implementation

### Sport Pages
- `NFL.tsx` (93KB), `CollegeFootball.tsx` (95KB)
- `NBA.tsx` (75KB), `NCAAB.tsx` (82KB)
- `MLB.tsx` - MLB predictions with game cards and bottom sheet details
- `features/mlbTools/f5Splits/` (`/mlb/f5-splits`) - Today's first-five inning team splits as a split view (feed + per-game detail); data from `mlb_games_today`, `mlb_starter_pregame`, and materialized view `mv_mlb_f5_team_splits` (refreshed daily ~11:00 UTC). Replaces `mlb/F5Splits.tsx`, which stays on disk unrouted.
- `features/mlbTools/pitcherMatchups/` (`/mlb/pitcher-matchups`) - Player prop matchups as a split view: posted props ranked against the break-even their price implies, plus starter arsenals and park/weather context, from `mlb_pitcher_arsenal`, `mlb_pitcher_batted_ball`, `mlb_game_lineups`, `get_mlb_player_props_l10`, `v_mlb_park_hr_factors`. Replaces `mlb/PitcherMatchups.tsx`, which stays on disk unrouted. Per-batter vs pitch-type drilldowns are not carried over — see `src/features/mlbTools/README.md`.
- `TodayInSports.tsx` (117KB) - Live dashboard

### Key Components
- `NFLGameCard.tsx` - With Aurora/ShineBorder effects
- `CFBDryRunSlateCardContent.tsx` - CFB dry-run slate content using NFL-style card hierarchy
- `CFBDryRunGameDetailsModal.tsx` - CFB 7-card prediction detail modal from `cfb_dryrun_picks`
- `GameDetailsModal.tsx` (119KB) - Full details
- `LiveScoreTicker.tsx` - Marquee ticker
- `PolymarketWidget.tsx` - Prediction markets

---

## Mobile Implementation

### Navigation
```
app/(drawer)/(tabs)/
├── index.tsx      # Feed (all 4 sports)
├── scoreboard.tsx # 8 leagues
├── picks.tsx      # Editor picks
└── outliers.tsx   # Anomalies
```

### Components
- `*GameCard.tsx` - Per sport
- `*GameBottomSheet.tsx` - Detail sheets
- `LiveScoreCard.tsx` / `LiveScoreDetailModal.tsx`

### Bottom Sheet Contexts
Separate context per sport: `NFLGameSheetContext`, `CFBGameSheetContext`, etc.

---

## Live Scores

### Web: Marquee Ticker
- Auto-scrolling, hover to pause
- 2-minute refresh

### Mobile: Full Scoreboard Tab
8 leagues: NFL, NCAAF, NBA, NCAAB, NHL, MLB, MLS, EPL

---

## Polymarket Integration

### Supported
NFL, CFB, NBA, NCAAB

### Cache Tables
- `polymarket_markets` - Game markets
- `polymarket_events` - Event lists (24h TTL)

### Service
Cache-first strategy with live API fallback

---

## Key Files

**Web**: `src/pages/NFL.tsx`, `src/services/polymarketService.ts`
**Mobile**: `wagerproof-mobile/services/gameDataService.ts`
