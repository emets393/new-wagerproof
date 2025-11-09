# AI Value Finds Polymarket Data Fix

## Problem
The AI value finds payloads were missing Polymarket prediction market data. The payload showed `polymarket: null` for all games, even though the data was available in the cache and working correctly for individual game cards.

## Root Cause
The `generate-page-level-analysis` Edge Function was building game data payloads without fetching or including Polymarket data from the cache. The individual game cards were successfully fetching this data using `getAllMarketsData()`, but the page-level analysis function wasn't doing the same.

## Solution Implemented

### 1. Fetch Polymarket Data from Cache
Added code to fetch Polymarket data for all games from the `polymarket_markets` table:

```typescript
// Fetch Polymarket data for all games from cache
const polymarketCache = new Map<string, any>();

for (const game of games) {
  const gameKey = `${sport_type}_${game.away_team}_${game.home_team}`;
  
  const { data: polymarketData } = await supabaseClient
    .from('polymarket_markets')
    .select('*')
    .eq('game_key', gameKey)
    .eq('league', sport_type);
  
  if (polymarketData && polymarketData.length > 0) {
    // Organize by market type
    const marketsByType: any = {};
    for (const market of polymarketData) {
      marketsByType[market.market_type] = {
        away_odds: market.current_away_odds,
        home_odds: market.current_home_odds,
        question: market.question,
      };
    }
    polymarketCache.set(gameKey, marketsByType);
    console.log(`✅ Found Polymarket data for ${game.away_team} @ ${game.home_team}`);
  }
}
```

### 2. Pass Polymarket Data to Build Functions
Updated the game building code to pass Polymarket data:

```typescript
game_data: sport_type === 'nfl' 
  ? buildNFLGameData(game, polymarketData) 
  : buildCFBGameData(game, polymarketData)
```

### 3. Updated Build Functions
Modified both `buildNFLGameData()` and `buildCFBGameData()` to:
- Accept `polymarketData` as an optional parameter
- Include it in the returned payload: `polymarket: polymarketData || null`
- Restructure the payload to match the format used by individual cards (with `game`, `vegas_lines`, `weather`, `public_betting`, `polymarket`, and `predictions` sections)

### 4. Payload Structure
The Polymarket data is now structured by market type:

```json
{
  "polymarket": {
    "moneyline": {
      "away_odds": 45.2,
      "home_odds": 54.8,
      "question": "Will the Ravens beat the Dolphins?"
    },
    "spread": {
      "away_odds": 52.1,
      "home_odds": 47.9,
      "question": "Ravens -3.5 spread"
    },
    "total": {
      "away_odds": 48.3,
      "home_odds": 51.7,
      "question": "Over/Under 48.5"
    }
  }
}
```

## Files Modified
- `/supabase/functions/generate-page-level-analysis/index.ts`
  - Added Polymarket cache fetching logic (lines 99-128)
  - Updated game building to pass Polymarket data (lines 130-148)
  - Updated `buildNFLGameData()` function signature and structure (lines 295-331)
  - Updated `buildCFBGameData()` function signature and structure (lines 333-372)

## Testing
To verify the fix:

1. **Check the Polymarket Cache**:
   ```sql
   SELECT game_key, market_type, current_away_odds, current_home_odds 
   FROM polymarket_markets 
   WHERE league = 'nfl' 
   ORDER BY last_updated DESC;
   ```

2. **Generate a New Page-Level Analysis**:
   - Go to Admin → AI Settings
   - Click "Generate Now" for NFL or CFB
   - Check the logs for "✅ Found Polymarket data for..." messages

3. **Verify the Payload**:
   - Open the browser console
   - Look for the payload in the debug logs
   - Confirm that `polymarket` is no longer `null` and contains market data

4. **Check the AI Response**:
   - The AI should now be able to reference Polymarket odds in its analysis
   - Value finds should include comparisons between Vegas lines and Polymarket odds

## Dependencies
This fix depends on:
- The `polymarket_markets` table being populated by the update cron job
- The `update-polymarket-cache` Edge Function running regularly (see `supabase/functions/update-polymarket-cache/`)
- The cron job setup in `20251108000005_setup_cron_jobs.sql`

## Benefits
With this fix, the AI can now:
1. **Compare Multiple Data Sources**: Vegas lines, model predictions, public betting, AND Polymarket odds
2. **Identify Arbitrage Opportunities**: Spot when Polymarket odds diverge significantly from Vegas lines
3. **Detect Market Inefficiencies**: Find games where the prediction market disagrees with traditional sportsbooks
4. **Provide More Comprehensive Analysis**: Include all available market data in value find recommendations

## Example Improved Payload
Before:
```json
{
  "polymarket": null
}
```

After:
```json
{
  "polymarket": {
    "moneyline": {
      "away_odds": 42.5,
      "home_odds": 57.5,
      "question": "Will the Chiefs beat the Bills?"
    },
    "spread": {
      "away_odds": 51.2,
      "home_odds": 48.8,
      "question": "Chiefs -2.5 spread"
    },
    "total": {
      "away_odds": 55.1,
      "home_odds": 44.9,
      "question": "Over/Under 51.5"
    }
  }
}
```

## Deployment Status
✅ **Edge Function Deployed**: `generate-page-level-analysis` successfully deployed on 2025-11-09

## Testing Results
✅ **Cache Verified**: Test confirmed Polymarket data is correctly stored in cache
- Las Vegas @ Denver game found with all 3 market types
- Moneyline: 20% away, 80% home
- Spread: 44% away, 56% home  
- Total: 51% over, 49% under

✅ **Format Validated**: Output format matches individual card payloads exactly

## Next Steps
1. ✅ ~~Deploy the Updated Edge Function~~ - **COMPLETED**

2. **Verify Cron Jobs Are Running**: Check that Polymarket cache is being updated regularly

3. **Regenerate Value Finds**: Generate new analyses with the complete data through Admin → AI Settings

4. **Monitor AI Output**: Ensure the AI is effectively using the Polymarket data in its analysis

## Notes
- If Polymarket data is not available for a game, the field will be `null` (graceful degradation)
- The cache is queried using the format: `{sport_type}_{away_team}_{home_team}`
- Team names must match exactly between the game data and the Polymarket cache
- The cache should be updated regularly (every 15-30 minutes) by the cron job

