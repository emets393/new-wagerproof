# Live Scores Prediction Display - Fix Summary

## Problem
The scoreboard and ticker were not showing whether bets were hitting or not hitting after a recent code change.

## Root Cause
On **November 8, 2025**, a commit (075d615) titled "Refactor NFL predictions fetching and filtering logic" made changes that broke the prediction display functionality.

### What Changed (Broken Version)
The refactor made these changes to `fetchNFLPredictions()`:

1. **Removed date filter when fetching latest run_id**:
   ```typescript
   // OLD (working): Filtered by today's date
   .select('run_id')
   .gte('game_date', today)
   .order('run_id', { ascending: false })
   
   // NEW (broken): No date filter
   .select('run_id')
   .order('run_id', { ascending: false })
   ```

2. **Changed prediction date range from "today" to "yesterday"**:
   ```typescript
   // OLD: today onwards
   .gte('game_date', today)
   
   // NEW: yesterday onwards  
   .gte('game_date', yesterdayStr)
   ```

3. **Added 6-hour time window filtering**:
   - Added logic to filter out games more than 6 hours past their start time
   - This added complexity without solving the core issue

### Why This Broke Predictions

The critical issue was **#1 above**. By removing the date filter when fetching the latest `run_id`, the query could return an old run_id from a previous date that:
- Doesn't have predictions for today's games
- Has predictions for old games that are no longer relevant
- Causes a mismatch when trying to match live games with predictions

The original code ensured that it got the **most recent run_id that has predictions for today's games**, which is exactly what's needed for live scoring.

## Solution
Reverted the `fetchNFLPredictions()` function in both web and mobile versions back to the working implementation:

### Files Changed
1. `src/services/liveScoresService.ts` (Web version)
2. `wagerproof-mobile/services/liveScoresService.ts` (Mobile version)

### Key Changes Made
- ✅ Restored date filter when fetching latest run_id: `.gte('game_date', today)`
- ✅ Restored prediction query to use today's date: `.gte('game_date', today)`
- ✅ Removed the 6-hour time window filtering logic
- ✅ Removed game_date and game_time fields from NFLPrediction interface
- ✅ Simplified the prediction fetching logic back to the working version

## How the Working Version Functions

1. **Get today's date** as a string (YYYY-MM-DD format)

2. **Fetch the latest run_id** that has predictions for today:
   ```typescript
   .from('nfl_predictions_epa')
   .select('run_id')
   .gte('game_date', today)  // ← Critical filter
   .order('run_id', { ascending: false })
   .limit(1)
   ```

3. **Fetch predictions** for today using that run_id:
   ```typescript
   .select('training_key, home_team, away_team, home_away_ml_prob, home_away_spread_cover_prob, ou_result_prob')
   .gte('game_date', today)
   .eq('run_id', latestRun.run_id)
   ```

4. **Fetch betting lines** and merge them with predictions

5. **Return the merged data** to be matched with live games

## Testing
After this fix, you should:
1. Check that the scoreboard shows prediction indicators (green dots for hitting, red for not hitting)
2. Verify the ticker shows games with prediction status
3. Hover/click on games to see detailed prediction breakdowns
4. Use the diagnostics tool at `/scoreboard/diagnostics` to verify:
   - Predictions are being fetched (count > 0)
   - Games are being matched with predictions
   - Hitting/not hitting status is calculated correctly

## Future Considerations
If you need to support games from yesterday (e.g., games that started late and are still playing), the better approach would be:

1. Keep the date filter on the run_id query to ensure fresh data
2. Add a check for games that are currently live rather than using arbitrary time windows
3. Filter by `is_live` status from the live_scores table instead of game time

This ensures you always get the most recent predictions while still supporting games that span multiple days.

