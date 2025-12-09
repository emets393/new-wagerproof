# Live Score Diagnostics Guide

## Overview

I've created a comprehensive diagnostics tool to help debug why the scoreboard and ticker might not be showing bets hitting or not hitting. The tool is now available at `/scoreboard/diagnostics`.

## How to Access

1. Navigate to the Scoreboard page (`/scoreboard`)
2. Click the **"Diagnostics"** button in the top-right corner (with a bug icon)
3. Or go directly to `/scoreboard/diagnostics`

## What the Diagnostics Tool Shows

### 1. **Summary Stats**
- **Live Games**: Number of live games currently in the database
- **NFL Predictions**: Number of NFL predictions available
- **CFB Predictions**: Number of CFB predictions available
- **Matched Games**: How many live games were successfully matched with predictions

### 2. **Enriched Games Section**
Shows all live games after they've been processed by the `useLiveScores` hook with:
- Game information (teams, scores, league)
- Whether predictions were found and attached
- For each prediction type (ML, Spread, O/U):
  - Whether it's hitting or not (green = hitting, red = not hitting)
  - The predicted outcome
  - The probability/confidence

### 3. **Game-Prediction Matching Details**
For each live game, shows:
- The live game details from ESPN
- The matched prediction from the database (if found)
- The raw prediction values (probabilities, lines)
- If no match was found, it will show this clearly

### 4. **Available Predictions**
Shows sample predictions from both NFL and CFB tables so you can see:
- What team names are stored in the predictions
- What prediction values are available

## What to Check

### Problem: No Predictions Showing

**Check 1: Are there predictions in the database?**
- Look at the summary stats
- If NFL/CFB Predictions = 0, the prediction tables are empty
- **Solution**: Ensure your prediction data pipelines are running and populating the tables

**Check 2: Are games being matched?**
- Look at "Matched Games" count
- If it's 0 but you have both live games and predictions, there's a team name mismatch
- **Solution**: Check the "Game-Prediction Matching Details" section to see the exact team names

**Check 3: Team name mismatches**
- Compare the team names in "Live Game" vs "Matched Prediction"
- Common issues:
  - Different formats (e.g., "Kansas City" vs "Kansas City Chiefs")
  - Abbreviations (e.g., "KC" vs "Kansas City")
  - The `teamMatching.ts` utility should handle most variations
- **Solution**: If names don't match, you may need to update the `teamNameMappings` in `src/utils/teamMatching.ts`

### Problem: Predictions Not Calculating Correctly

**Check 4: Are prediction values NULL?**
- Look at the matched prediction details
- Check if `home_away_ml_prob`, `home_spread`, `over_line` (NFL) or `pred_ml_proba`, `api_spread`, `api_over_line` (CFB) are null
- **Solution**: Ensure your prediction tables have complete data

**Check 5: Are scores updating?**
- Check if the game scores in "Live Game" match current real-time scores
- **Solution**: The `fetch-live-scores` edge function should run every 2 minutes. Check if it's running.

## Understanding the Calculation Logic

The system calculates if predictions are "hitting" as follows:

### Moneyline
- Predicted winner is determined by `probability > 0.5`
- Hitting if predicted team's score is higher than opponent

### Spread
- Predicted cover is determined by `probability > 0.5`
- Hitting if: `(home_score - away_score) + spread_line > 0` for home, or `< 0` for away

### Over/Under
- Predicted result is determined by `probability > 0.5`
- Hitting if: `(home_score + away_score) > line` for Over, or `< line` for Under

## Data Flow

1. **ESPN** → `fetch-live-scores` edge function → `live_scores` table
2. `live_scores` table → `useLiveScores` hook → `enrichGamesWithPredictions()`
3. `nfl_predictions_epa` + `nfl_betting_lines` tables (NFL) or `cfb_live_weekly_inputs` table (CFB)
4. `gamesMatch()` matches games with predictions by team names
5. `calculatePredictionStatus()` determines if predictions are hitting
6. Results displayed in ticker and scoreboard

## Files to Check

If you need to debug further, check these key files:
- `src/services/liveScoresService.ts` - Main logic for fetching and enriching games
- `src/utils/teamMatching.ts` - Team name matching logic
- `supabase/functions/fetch-live-scores/index.ts` - Fetches live scores from ESPN
- `src/hooks/useLiveScores.ts` - React hook that components use

## Common Issues & Solutions

### Issue: "No live games"
- **Cause**: No games are currently live, or the `fetch-live-scores` function hasn't run
- **Solution**: Wait for game time, or manually trigger a refresh

### Issue: "Has predictions" shows but ticker shows no indicators
- **Cause**: The `hasAnyHitting` flag might be false for all predictions
- **Check**: Look at the prediction calculation - all predictions might be "not hitting"
- **This is normal**: If model predictions aren't performing well in current games

### Issue: Predictions exist but `hasMatch = false`
- **Cause**: Team names don't match between live_scores and predictions tables
- **Solution**: 
  1. Look at the exact team names in both tables
  2. Update `teamNameMappings` in `src/utils/teamMatching.ts` if needed
  3. Or update the data in your prediction tables to use consistent team names

## Next Steps

1. Open the diagnostics page and review all sections
2. Identify which check is failing (no predictions, no matches, or calculation issue)
3. Use the information to determine if it's a data issue or code issue
4. Share findings if you need further assistance

