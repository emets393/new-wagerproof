# Live Score Predictions Feature - Testing Guide

## What Was Implemented

### 1. **Type Extensions** (`src/types/liveScores.ts`)
- Added `GamePredictions` interface to track moneyline, spread, and over/under predictions
- Added `PredictionStatus` interface to track if each bet type is hitting
- Extended `LiveGame` to include optional `predictions` field

### 2. **Team Matching Utility** (`src/utils/teamMatching.ts`)
- Created `normalizeTeamName()` to handle team name variations
- Created `teamsMatch()` to compare team names (handles "LA" vs "Los Angeles", etc.)
- Created `gamesMatch()` to match games by both teams
- Includes mappings for all NFL teams and common variations

### 3. **Prediction Service** (`src/services/liveScoresService.ts`)
- **NFL Predictions**: Fetches from `nfl_predictions_epa` table (probabilities) + `nfl_betting_lines` table (lines)
- **CFB Predictions**: Fetches from `cfb_live_weekly_inputs` table
- **Matching Logic**: Uses team name matching to link predictions to live games
- **Hitting Calculation**:
  - Moneyline: Predicted team is currently ahead
  - Spread: Predicted team is covering the spread
  - Over/Under: Current total is over/under the line
- Automatically enriches all live scores with prediction data

### 4. **Visual Highlighting** (`src/components/LiveScoreCard.tsx`)
- Games with hitting predictions show:
  - Honeydew-500 border glow
  - Subtle pulsing animation
  - Shadow effect for visibility
- Games without hitting predictions appear normal

### 5. **Expandable Hover Card** (`src/components/LiveScorePredictionCard.tsx`)
- Appears on hover over any game with predictions
- Shows team circles with colors and abbreviations
- Displays current score prominently
- Lists all three prediction types with:
  - ✓ Checkmark for hitting predictions (green)
  - ✗ X mark for not hitting (red/gray)
  - Probability percentage
  - Betting line (for spread/O-U)
  - Current status

### 6. **Hover Integration**
- Uses Radix UI HoverCard component
- 200ms delay before opening
- 100ms delay before closing
- Positioned below the ticker card
- Only shows for games with predictions

## How to Test

### Prerequisites
1. Need active live games (NFL or CFB)
2. Need predictions in database for those games
3. Team names must match between ESPN data and prediction tables

### Testing Steps

1. **Start the dev server** (if not already running):
   ```bash
   npm run dev
   ```

2. **Navigate to a page with the live score ticker** (should appear at top if live games exist)

3. **Look for highlighted cards**:
   - Cards with glowing green borders = predictions are hitting
   - Normal cards = no predictions or predictions not hitting

4. **Hover over a card**:
   - Should expand to show detailed prediction card
   - Shows all three bet types with status
   - Green checkmarks = hitting, Red X = not hitting

### Debugging

Check browser console for these logs:
```
Fetched X NFL predictions and Y CFB predictions
✅ Matched NFL game: [team] @ [team]
📊 Prediction status for [team] @ [team]: { hasAnyHitting: true/false, ... }
```

If you see "No NFL predictions found for today" or "No CFB predictions", the prediction tables may not have current data.

### Common Issues

1. **No hover card appears**:
   - Check if predictions are being fetched (console logs)
   - Verify team names match (console logs show matched games)
   - Ensure HoverCard is not being blocked by parent overflow styles

2. **No highlighting**:
   - Predictions might not be "hitting" yet (check scores)
   - Predictions might not be matched (team name mismatch)

3. **Cards don't appear at all**:
   - No live games currently
   - `is_live` flag is false in database
   - Live score ticker is hidden on small screens (hidden below sm: breakpoint)

## Data Flow

```
LiveScoreTicker (renders)
  ↓
useLiveScores hook
  ↓
getLiveScores() in liveScoresService
  ↓
enrichGamesWithPredictions()
  ↓
fetchNFLPredictions() & fetchCFBPredictions()
  ↓
gamesMatch() - team name matching
  ↓
calculatePredictionStatus() - determine if hitting
  ↓
LiveGame with predictions
  ↓
LiveScoreCard (with highlighting + hover)
  ↓
LiveScorePredictionCard (on hover)
```

## Future Enhancements

- Add team logos instead of just abbreviations
- Show multiple model predictions (not just one)
- Add historical accuracy for each model
- Show live odds movement
- Add click to go to game details page

