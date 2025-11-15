# Basketball Live Scores Prediction Connection Fix

## Summary
Fixed the sports ticker so that live NBA and College Basketball games now connect to predictions and show live status, just like NFL and College Football games do.

## Problem
The sports ticker was displaying live NBA and NCAAB games but wasn't connecting them to predictions like it does for NFL and CFB games. This meant basketball games showed no prediction status indicators (hitting/not hitting).

## Root Causes

### 1. Type Restriction
The `LiveGame` interface in `src/types/liveScores.ts` only allowed `'NFL' | 'NCAAF'` leagues, excluding basketball:
```typescript
// BEFORE:
league: 'NFL' | 'NCAAF';

// AFTER:
league: 'NFL' | 'NCAAF' | 'NBA' | 'NCAAB';
```

### 2. Missing Basketball Prediction Fetching
The `enrichGamesWithPredictions` function in `src/services/liveScoresService.ts` only fetched NFL and CFB predictions, completely ignoring basketball predictions.

### 3. No Basketball Prediction Matching
The enrichment logic only matched NFL and NCAAF games with predictions - basketball games were skipped entirely.

## Changes Made

### Web Application (`src/`)

#### 1. Updated Type Definitions (`src/types/liveScores.ts`)
- Extended `LiveGame` interface to include `'NBA' | 'NCAAB'` in the league union type

#### 2. Enhanced Live Scores Service (`src/services/liveScoresService.ts`)

**Added Basketball Prediction Interfaces:**
```typescript
interface NBAPrediction {
  game_id: number;
  home_team: string;
  away_team: string;
  home_win_prob: number | null;
  away_win_prob: number | null;
  home_score_pred: number | null;
  away_score_pred: number | null;
  model_fair_home_spread: number | null;
  model_fair_total: number | null;
  vegas_home_spread: number | null;
  vegas_total: number | null;
}

interface NCAABPrediction {
  game_id: number;
  home_team: string;
  away_team: string;
  home_win_prob: number | null;
  away_win_prob: number | null;
  home_score_pred: number | null;
  away_score_pred: number | null;
  model_fair_home_spread: number | null;
  model_fair_away_spread: number | null;
  vegas_home_spread: number | null;
  vegas_total: number | null;
  pred_home_margin: number | null;
  pred_total_points: number | null;
}
```

**Added Fetch Functions:**
- `fetchNBAPredictions()`: Fetches NBA predictions from `nba_predictions` table and merges with Vegas lines from `nba_input_values_view`
- `fetchNCAABPredictions()`: Fetches NCAAB predictions from `ncaab_predictions` table

**Updated Prediction Calculation:**
- Modified `calculatePredictionStatus()` to handle basketball predictions
- Added logic to derive moneyline, spread, and over/under picks from basketball model data:
  - **Moneyline**: Uses `home_win_prob` directly
  - **Spread**: Compares `model_fair_home_spread` vs `vegas_home_spread` to determine edge
  - **Over/Under**: Compares `model_fair_total` vs `vegas_total` or uses `pred_total_points` for NCAAB

**Updated Game Enrichment:**
- Modified `enrichGamesWithPredictions()` to fetch all four sports predictions in parallel
- Added matching logic for NBA and NCAAB games using `gamesMatch()` utility
- Now properly logs matching attempts and results for basketball games

### Mobile Application (`wagerproof-mobile/`)

Applied identical changes to the mobile app:
- Updated prediction interfaces in `services/liveScoresService.ts`
- Added `fetchNBAPredictions()` and `fetchNCAABPredictions()` functions
- Enhanced `calculatePredictionStatus()` to handle basketball predictions
- Updated `enrichGamesWithPredictions()` to match basketball games

Note: Mobile app already had `league: string` type which was flexible enough for all leagues.

## How It Works Now

1. **Live scores are fetched** from ESPN API via the `fetch-live-scores` edge function
2. **Predictions are fetched** for all four sports (NFL, CFB, NBA, NCAAB) in parallel
3. **Games are matched** with predictions using team name matching logic
4. **Prediction status is calculated** based on:
   - Current score differential vs predicted winner (moneyline)
   - Adjusted score differential vs spread line (spread)
   - Total points vs over/under line (over/under)
5. **Live ticker displays** games with prediction indicators:
   - Green pulse = predictions are hitting
   - Red = predictions not hitting
   - Shows ML, spread, and O/U status

## Database Tables Used

### NBA:
- `nba_predictions`: Model predictions with latest `run_id`
- `nba_input_values_view`: Game details and Vegas lines

### NCAAB:
- `ncaab_predictions`: Model predictions with latest `run_id`
- Contains both model predictions and Vegas lines in one table

## Testing

The fix can be tested by:
1. Waiting for live NBA or NCAAB games
2. Ensuring predictions exist in the database for those games
3. Checking the live ticker shows green/red indicators for basketball games
4. Verifying debug logs show successful matching: `✅ Matched NBA game: ...`

## Debug Logging

Added comprehensive debug logging:
```
🏀 Trying to match NBA game: Team A @ Team B
   ✅ Matched NBA game: Team A @ Team B
   📊 Calculating prediction status for: A 65 @ B 72
   ✅ Result: { hasAnyHitting: true, ... }
```

## Future Improvements

Could add:
- NHL, MLB, MLS, EPL predictions when models become available
- More sophisticated probability derivation for basketball
- Caching of predictions to reduce database calls
- Real-time updates when predictions are recalculated mid-game

