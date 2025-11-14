# NBA Polymarket Cache Fix - Complete Audit & Fix

## Issues Found

1. **Team Name Normalization Bug**: `getTeamName()` for NBA was incorrectly using `getTeamMascot()` (NFL logic), but NBA team names are already full names like "Charlotte Hornets"
2. **Rigid Matching Logic**: Event matching was too strict, requiring exact full team name matches
3. **Date Range Too Narrow**: Only fetching games for today, missing games scheduled for tomorrow/this week
4. **Missing NBA Stats**: No detailed logging to track NBA game processing

## Fixes Applied

### 1. Fixed Team Name Normalization (`getTeamName` function)

**File**: `supabase/functions/update-polymarket-cache/index.ts` (lines 105-116)

**Before**:
```typescript
function getTeamName(teamName: string, league: 'nfl' | 'cfb' | 'nba' | 'ncaab'): string {
  if (league === 'cfb' || league === 'ncaab') {
    return CFB_TEAM_MAPPINGS[teamName] || teamName;
  }
  // NBA and NFL both use mascot-based names
  return getTeamMascot(teamName); // ❌ Wrong for NBA!
}
```

**After**:
```typescript
function getTeamName(teamName: string, league: 'nfl' | 'cfb' | 'nba' | 'ncaab'): string {
  if (league === 'cfb' || league === 'ncaab') {
    return CFB_TEAM_MAPPINGS[teamName] || teamName;
  }
  if (league === 'nba') {
    // NBA team names are already full names (e.g., "Charlotte Hornets"), return as-is
    return teamName; // ✅ Correct!
  }
  // NFL uses mascot-based names
  return getTeamMascot(teamName);
}
```

### 2. Improved Event Matching Logic

**File**: `supabase/functions/update-polymarket-cache/index.ts` (lines 506-550)

**Changes**:
- Added flexible keyword matching (matches "Hornets" when team is "Charlotte Hornets")
- Handles reversed team order in Polymarket titles
- Extracts key words from team names for better matching

**Key Features**:
- Matches mascot names (e.g., "Hornets", "Bucks") even when full name is "Charlotte Hornets"
- Handles variations like "Hornets vs. Bucks" or "Charlotte Hornets vs. Milwaukee Bucks"
- Checks both normal and reversed team order

### 3. Extended Date Range

**File**: `supabase/functions/update-polymarket-cache/index.ts` (lines 136-181)

**Before**: Only fetched games for today
```typescript
const today = new Date().toISOString().split('T')[0];
.gte('game_date', today)
```

**After**: Fetches games for next 7 days (matching frontend logic)
```typescript
const today = new Date().toISOString().split('T')[0];
const weekFromNow = new Date();
weekFromNow.setDate(weekFromNow.getDate() + 7);
const weekFromNowStr = weekFromNow.toISOString().split('T')[0];
.gte('game_date', today)
.lte('game_date', weekFromNowStr)
```

### 4. Added Detailed Logging

**File**: `supabase/functions/update-polymarket-cache/index.ts` (lines 372-378, 405, 474, 488, 502)

**Added**:
- `leagueStats` tracking for each league (total games, matched events, markets created)
- Detailed logging of NBA game processing
- Response includes `leagueStats` object with breakdown by league

## Deployment Steps

### 1. Deploy Updated Function

```bash
cd /Users/chrishabib/Documents/new-wagerproof
supabase functions deploy update-polymarket-cache
```

**OR** via Supabase Dashboard:
1. Go to Edge Functions → `update-polymarket-cache`
2. Copy updated code from `supabase/functions/update-polymarket-cache/index.ts`
3. Deploy

### 2. Test Cache Update

```bash
curl -X POST "https://gnjrklxotmbvnxbnnqgq.supabase.co/functions/v1/update-polymarket-cache" \
  -H "Authorization: Bearer [your-anon-key]" \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
{
  "success": true,
  "updated": 200,
  "games": 125,
  "nbaGames": 9,
  "leagueStats": {
    "nba": {
      "total": 9,
      "matched": 8,
      "markets": 24
    }
  }
}
```

### 3. Verify NBA Markets in Database

```sql
SELECT 
  league,
  COUNT(*) as market_count,
  COUNT(DISTINCT game_key) as unique_games
FROM polymarket_markets
WHERE league = 'nba'
GROUP BY league;
```

## Expected Results

After deployment:

1. **NBA games will be fetched** from `nba_input_values_view` for next 7 days
2. **Team names will match correctly** (no more mascot conversion for NBA)
3. **Events will match more reliably** using flexible keyword matching
4. **NBA markets will be cached** in `polymarket_markets` table
5. **Value Alerts will show NBA games** when markets exist and odds >57%

## Testing Checklist

- [ ] Deploy updated function
- [ ] Run cache update manually
- [ ] Verify `nbaGames` count > 0 in response
- [ ] Check `leagueStats.nba.matched` > 0
- [ ] Verify NBA markets exist in database
- [ ] Refresh Today in Sports page
- [ ] Confirm NBA games appear in Value Alerts section
- [ ] Check console logs show NBA markets being found

## Debugging

If NBA markets still don't appear:

1. **Check function logs**:
   ```bash
   supabase functions logs update-polymarket-cache
   ```

2. **Look for**:
   - `📋 Found X NBA games from nba_input_values_view` (should be > 0)
   - `🔍 Looking for NBA: [team] vs [team]` (shows matching attempts)
   - `✅ Matched: "[event title]"` (shows successful matches)
   - `📊 League Stats: {"nba": {...}}` (shows processing stats)

3. **Check database**:
   ```sql
   -- See what NBA game_keys exist
   SELECT DISTINCT game_key, away_team, home_team 
   FROM polymarket_markets 
   WHERE league = 'nba';
   
   -- Compare with what frontend is searching for
   -- Frontend searches: nba_{awayTeam}_{homeTeam}
   ```

## Related Files

- `supabase/functions/update-polymarket-cache/index.ts` - Cache update function (fixed)
- `src/pages/TodayInSports.tsx` - Frontend Value Alerts query (already has debug logging)
- `src/services/polymarketService.ts` - Client-side Polymarket service (reference for matching logic)

