# AI Settings Payload Tester - Polymarket Fix

## Problem
When clicking "Test Payload" in AI Settings, the frontend was throwing 404 errors:
```
GET .../polymarket_odds?game_id=in.(...)&sport=eq.NFL 404 (Not Found)
```

## Root Cause
The frontend code was trying to query an old table structure that doesn't exist:
- **Wrong table name**: `polymarket_odds` 
- **Wrong column names**: `game_id` and `sport`
- **Wrong data structure**: Expected flat columns like `ml_away_odds`, `spread_away_odds`, etc.

## Actual Table Structure
The actual table is `polymarket_markets` with this structure:
- **Table name**: `polymarket_markets`
- **Key columns**: 
  - `game_key` (format: `{sport}_{away_team}_{home_team}`)
  - `league` (values: `'nfl'` or `'cfb'`)
  - `market_type` (values: `'moneyline'`, `'spread'`, `'total'`)
- **Data columns**: `current_away_odds`, `current_home_odds`, `question`
- **Structure**: One row per market type per game (normalized)

## Solution Applied

### 1. Fixed Table Query (lines 458-489)
**Before:**
```typescript
const { data: polymarketData } = await collegeFootballSupabase
  .from('polymarket_odds')  // ❌ Wrong table
  .select('*')
  .in('game_id', gameIds)   // ❌ Wrong column
  .eq('sport', sportType.toUpperCase());  // ❌ Wrong column & format
```

**After:**
```typescript
const gameKeys = games.map(g => `${sportType}_${g.away_team}_${g.home_team}`);
const { data: polymarketRawData } = await collegeFootballSupabase
  .from('polymarket_markets')  // ✅ Correct table
  .select('*')
  .in('game_key', gameKeys)    // ✅ Correct column & format
  .eq('league', sportType);    // ✅ Correct column
```

### 2. Added Data Transformation (lines 470-489)
Since the table is normalized (one row per market type), we need to organize it by game:

```typescript
const polymarketByGame = new Map<string, any>();
if (polymarketRawData) {
  for (const market of polymarketRawData) {
    if (!polymarketByGame.has(market.game_key)) {
      polymarketByGame.set(market.game_key, {});
    }
    const gameData = polymarketByGame.get(market.game_key);
    
    // Special handling for totals: use over_odds/under_odds
    if (market.market_type === 'total') {
      gameData.total = {
        over_odds: market.current_away_odds,   // Away = Over
        under_odds: market.current_home_odds,  // Home = Under
      };
    } else {
      // For moneyline and spread: use away_odds/home_odds
      gameData[market.market_type] = {
        away_odds: market.current_away_odds,
        home_odds: market.current_home_odds,
      };
    }
  }
}
```

### 3. Updated Payload Building (lines 496-498)
**Before:**
```typescript
const polymarket = polymarketData?.find(p => p.game_id === gameId);
// Then had to restructure from flat columns...
```

**After:**
```typescript
const gameKey = `${sportType}_${game.away_team}_${game.home_team}`;
const polymarketFormatted = polymarketByGame.get(gameKey) || null;
```

## Result Format
The Polymarket data now appears in the payload with the correct structure:

```json
{
  "polymarket": {
    "moneyline": {
      "away_odds": 20,
      "home_odds": 80
    },
    "spread": {
      "away_odds": 44,
      "home_odds": 56
    },
    "total": {
      "over_odds": 51,
      "under_odds": 49
    }
  }
}
```

This matches exactly what:
1. Individual game cards display
2. The Edge Function sends to OpenAI
3. The AI expects to see in its analysis

## Files Modified
- `/src/pages/admin/AISettings.tsx` (lines 458-498)

## Testing
1. Go to **Admin → AI Settings → Page-Level Analysis**
2. Click **"Test Payload"** for NFL or CFB
3. **No more 404 errors** - Polymarket data loads correctly
4. Check the payload JSON - `polymarket` fields should be populated (not `null`)
5. Click **"Generate Test Analysis"** - AI can now analyze Polymarket odds

## Benefits
✅ **Fixed 404 Errors**: Queries correct table with correct columns
✅ **Consistent Data Format**: Matches Edge Function and individual cards
✅ **Proper Over/Under**: Totals use `over_odds`/`under_odds` instead of away/home
✅ **Normalized Structure**: Handles multiple market types per game correctly
✅ **Graceful Fallback**: Returns `null` if no Polymarket data available for a game

## Related Changes
This frontend fix complements the Edge Function fix from `AI_VALUE_FINDS_POLYMARKET_FIX.md`. Both now:
- Query `polymarket_markets` table
- Use `game_key` format: `{sport}_{away_team}_{home_team}`
- Format totals with `over_odds`/`under_odds`
- Provide consistent data structure to OpenAI

