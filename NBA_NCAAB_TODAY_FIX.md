# NBA and NCAAB Today in Sports Fix

## Summary
Fixed missing NBA and NCAAB games from Today in Sports page by correcting the Polymarket cache data source and adding comprehensive debug logging to track basketball games through all sections.

## Changes Made

### 1. Fixed Polymarket Cache NBA Data Source
**File**: `supabase/functions/update-polymarket-cache/index.ts`

**Issue**: The function was querying from `nba_games` table, but the app uses `nba_input_values_view`.

**Fix**: Changed line 168 from:
```typescript
.from('nba_games')
```
to:
```typescript
.from('nba_input_values_view')
```

Added enhanced logging to track NBA games fetched from the correct view.

### 2. Enhanced Debug Logging for Basketball Games
**File**: `src/pages/TodayInSports.tsx`

Added comprehensive logging throughout the page to track NBA and NCAAB games:

#### Today's Games Filter (lines 680-750)
- Added basketball-specific logging with 🏀 emoji for easy identification
- Enhanced filter results to show game counts by sport (NFL, CFB, NBA, NCAAB)
- Added specific error messages for invalid dates or missing gameTime fields

#### Value Alerts Section (lines 763-794)
- Added logging to track how many basketball games are being checked
- Added sport-specific Polymarket query logging for NBA/NCAAB
- Enhanced market count logging with basketball emoji for visibility

#### High Tailing It Section (lines 1236-1267)
- Added 🏀 emoji to basketball game ID logging
- Added unique game ID tracking for both NBA and NCAAB separately
- Added comparison logging between expected and found basketball game IDs

## How It Works

### Data Flow for NBA/NCAAB Games

1. **Week Games Query**: Fetches all NBA and NCAAB games from this week using:
   - NBA: `nba_input_values_view` table
   - NCAAB: `v_cbb_input_values` table

2. **Today Games Filter**: Filters week games to only today's games by:
   - Parsing `gameTime` field (format: "YYYY-MM-DDTHH:MM:SS")
   - Converting to Eastern Time
   - Comparing against today's date

3. **Polymarket Value Alerts**: Checks for Polymarket markets where:
   - Spread/Total markets: >57% odds (line mismatch indicator)
   - Moneyline markets: ≥85% odds (strong consensus)
   - Uses `game_key` format: `{sport}_{away_team}_{home_team}`

4. **High Tailing It**: Shows top 5 most tailed games by:
   - Querying `game_tails` table with `sport IN ('nfl', 'cfb', 'nba', 'ncaab')`
   - Matching `game_unique_id` with `gameId` from week games
   - Grouping tails by pick type and team selection

## GameID Format Consistency

All sections use consistent gameId formats:
- **NBA**: String version of `game_id` from `nba_input_values_view`
- **NCAAB**: String version of `game_id` from `v_cbb_input_values`
- **Game Tails**: Matches the gameId format above in `game_unique_id` field

## Testing

To verify the fixes are working:

1. **Check Console Logs**: Look for 🏀 basketball game logging showing:
   - How many NBA/NCAAB games are in weekGames
   - How many pass the today filter
   - Which games have Polymarket markets
   - Which games have tails

2. **Today's Games Section**: Should show NBA/NCAAB games if they're scheduled for today

3. **Value Summary Section**: Should show NBA/NCAAB games with >57% Polymarket odds (if available)

4. **High Tailing It Section**: Should show NBA/NCAAB games that users have tailed (if tails exist)

## Next Steps

1. **Deploy Polymarket Cache Update**: Redeploy the `update-polymarket-cache` edge function to start fetching NBA games from the correct table

2. **Run Polymarket Cache Update**: Manually trigger or wait for the cron job to populate Polymarket data for NBA/NCAAB games

3. **Verify Data**: Check that:
   - NBA/NCAAB games appear in all three sections
   - Polymarket markets show for basketball games (if available on Polymarket)
   - Tailed basketball games appear in High Tailing It section

## Expected Behavior

After the Polymarket cache is updated:
- **Today's Games**: Will show all NBA/NCAAB games scheduled for today
- **Value Summary**: Will show NBA/NCAAB games with strong Polymarket signals (when markets exist)
- **High Tailing It**: Will show NBA/NCAAB games that users have tailed

## Notes

- The date filtering logic was already correct - it handles both football and basketball games properly
- The gameId format was already consistent - no changes needed
- The main issue was the Polymarket cache using the wrong NBA table
- Enhanced logging will help debug any future issues with basketball games

