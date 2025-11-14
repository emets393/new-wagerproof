# NBA/NCAAB Polymarket Fix - Implementation Complete

## Summary

Fixed the Polymarket value alerts system for NBA and NCAAB games to ensure they appear correctly on the Today in Sports page.

## Root Cause

**Team Name Format Mismatch**: 
- **NBA**: Database stores full names ("Charlotte Hornets"), but Polymarket uses mascots only ("Hornets")
- **NCAAB**: Database stores school names ("Duke"), but Polymarket uses full names with mascots ("Duke Blue Devils")

## Changes Made

### 1. Cache Function (`supabase/functions/update-polymarket-cache/index.ts`)

**Added NBA Team Mappings** (lines 52-86):
```typescript
const NBA_TEAM_TO_MASCOT: Record<string, string> = {
  'Charlotte Hornets': 'Hornets',
  'Milwaukee Bucks': 'Bucks',
  'Los Angeles Lakers': 'Lakers',
  // ... all 30 NBA teams
};
```

**Updated `getTeamName()` function** (lines 141-167):
- **NBA**: Extracts mascot from full name before matching with Polymarket
- **NCAAB**: Uses school name with flexible matching logic
- Added comprehensive logging for debugging

**Enhanced `findMatchingEvent()` function** (lines 577-666):
- **NCAAB**: Implements word-based matching (e.g., "Duke" matches "Duke Blue Devils")
- **NBA**: Uses standard keyword matching with extracted mascots
- Added debug logging to track matching success/failure

### 2. Polymarket Service (`src/services/polymarketService.ts`)

**Added NBA Team Mappings** (lines 100-134):
```typescript
const NBA_TEAM_TO_MASCOT: Record<string, string> = {
  // Same mappings as cache function
};
```

**Updated `mapTeamNameToPolymarket()` function** (lines 568-581):
- Extracts mascot for NBA teams before matching
- Maintains consistency with cache function logic

**Updated `getTeamMascot()` function** (lines 592-599):
- Also handles NBA mascot extraction for backward compatibility

### 3. Game Key Consistency

**Verified consistent format across all components**:
- Cache function: `{league}_{away_team}_{home_team}` using RAW database names
- Frontend query: `{sport}_{awayTeam}_{homeTeam}` using RAW database names
- Team normalization is ONLY for Polymarket API matching, not for cache keys

Example:
- Game: "Charlotte Hornets" @ "Milwaukee Bucks"
- gameKey: "nba_Charlotte Hornets_Milwaukee Bucks" (stored and queried)
- Polymarket match: "Hornets" vs "Bucks" (normalized for API)

## Testing Instructions

### 1. Trigger Cache Update

Via Supabase Dashboard:
1. Go to Edge Functions → update-polymarket-cache
2. Click "Invoke" button
3. Check logs for NBA/NCAAB processing

Via CLI:
```bash
curl -X POST 'https://[YOUR-PROJECT].supabase.co/functions/v1/update-polymarket-cache' \
  -H "Authorization: Bearer [YOUR-ANON-KEY]" \
  -H "Content-Type: application/json"
```

### 2. Verify Cache Population

Query the database:
```sql
-- Check NBA markets
SELECT game_key, away_team, home_team, market_type, current_away_odds, current_home_odds, last_updated
FROM polymarket_markets
WHERE league = 'nba'
ORDER BY last_updated DESC
LIMIT 10;

-- Check NCAAB markets
SELECT game_key, away_team, home_team, market_type, current_away_odds, current_home_odds, last_updated
FROM polymarket_markets
WHERE league = 'ncaab'
ORDER BY last_updated DESC
LIMIT 10;

-- Check for value alerts (>57% on spread/total)
SELECT game_key, away_team, home_team, market_type, current_away_odds, current_home_odds
FROM polymarket_markets
WHERE league IN ('nba', 'ncaab')
  AND market_type IN ('spread', 'total')
  AND (current_away_odds > 57 OR current_home_odds > 57);
```

### 3. Verify on Today in Sports Page

1. Navigate to /today-in-sports
2. Check "Value Summary" section
3. Verify NBA/NCAAB games appear in "Polymarket Value Alerts"
4. Verify correct odds are displayed

Expected behavior:
- Games with >57% odds on spread/total should appear
- Games with ≥85% odds on moneyline should appear  
- Team names should match database format
- Odds should match Polymarket current values

## Debug Logging

The cache function now includes comprehensive logging:

```
NBA team mapping: "Charlotte Hornets" -> "Hornets"
🔍 Looking for NBA: Charlotte Hornets (Hornets) vs Milwaukee Bucks (Bucks)
  Away keywords: [hornets]
  Home keywords: [bucks]
✅ Matched: "Hornets vs. Bucks"
✅ Updated spread: 52% - 48%
✅ Updated total: 61% - 39%
```

Check Edge Function logs in Supabase Dashboard to debug any issues.

## Known Behaviors

1. **NCAAB Multi-word Schools**: Schools like "Penn State", "North Carolina" are handled correctly with flexible word-based matching
2. **LA vs Los Angeles**: Both "LA Clippers" and "Los Angeles Clippers" map to "Clippers"
3. **Portland Trail Blazers**: Kept as "Trail Blazers" (two words) since that's how Polymarket lists them
4. **Fallback Matching**: If a team isn't in the mapping, the last word is extracted as the mascot

## Maintenance

To add new teams or fix mappings:

1. Update `NBA_TEAM_TO_MASCOT` in **both** files:
   - `supabase/functions/update-polymarket-cache/index.ts`
   - `src/services/polymarketService.ts`

2. For NCAAB teams, update `CBB_TEAM_MAPPINGS` in both files (if needed)

3. Test by triggering cache update and checking logs

## Related Files

- `supabase/functions/update-polymarket-cache/index.ts` - Cache update logic
- `src/services/polymarketService.ts` - Frontend Polymarket service
- `src/pages/TodayInSports.tsx` - Today in Sports page (value alerts display)
- `src/components/PolymarketWidget.tsx` - Polymarket widget on game cards
- `src/pages/NBA.tsx` - NBA page (uses PolymarketWidget)
- `src/pages/NCAAB.tsx` - NCAAB page (uses PolymarketWidget)

## Next Steps

1. ✅ Deploy cache function (DONE)
2. ⏳ Trigger cache update to populate NBA/NCAAB data
3. ⏳ Verify data in polymarket_markets table
4. ⏳ Test value alerts on Today in Sports page
5. ⏳ Monitor for any edge cases or missing teams

## Deployment Status

- ✅ Cache function deployed
- ✅ Frontend code committed
- ⏳ Cache populated (pending - trigger manually)
- ⏳ Testing completed (pending - requires network access)

