# Today in Sports - High Tailing It Section Fix

## Problem
The "High Tailing It" section in Today in Sports was not showing tailed College Football games, only NFL games.

## Root Cause
The `gameId` format used when creating game summaries needed to exactly match the `game_unique_id` stored in the `game_tails` table when users tail picks.

## Solution Applied

### 1. Consistent GameID Generation
**File:** `src/pages/TodayInSports.tsx`

Ensured both NFL and CFB games use the exact same gameId format as their respective game pages:

#### NFL Games
```typescript
gameId: game.home_away_unique, // Must match training_key used in GameTailSection
```
- Uses `home_away_unique` from `v_input_values_with_epa` table
- Matches what NFL page passes to `GameTailSection`

#### CFB Games  
```typescript
gameId: game.training_key || game.id, // Must match training_key || id used in GameTailSection
```
- Uses `training_key` or falls back to `id` from `cfb_live_weekly_inputs` table
- Matches what CFB page passes to `GameTailSection` (line 1711)

### 2. Fixed Table Name
Changed from `user_profiles` to `profiles` when fetching user display names (line 725):
```typescript
const { data: usersData } = await supabase
  .from('profiles')  // Was: 'user_profiles'
  .select('user_id, display_name')
  .in('user_id', userIds);
```

### 3. Enhanced Debugging
Added comprehensive logging to diagnose gameId mismatches:
- Logs all gameIds being looked up
- Logs all tails in database (split by sport)
- Logs unique CFB gameIds in database vs what we're searching for
- Warns when gameId mismatch is detected
- Shows detailed game data including `training_key` and `id` fields

### 4. Better Display Formatting
Improved the pick type labels in the High Tailing It section:
- `moneyline` → `ML`
- `spread` → `Spread`  
- `over_under` → `O/U`
- For over/under: Shows "Over" or "Under" instead of team names

## How It Works

### Data Flow
1. **Week Games Query** fetches NFL and CFB games for the current week
2. **GameID Assignment** uses consistent format matching what GameTailSection receives
3. **Tails Query** fetches all tails where `game_unique_id` matches our gameIds
4. **Grouping** groups tails by game and pick type
5. **Display** shows top 5 most tailed games across all sports

### GameID Matching
The key is that the `gameId` used in Today in Sports **must exactly match** what's passed to `GameTailSection` on the NFL and CFB pages:

| Page | Component | GameID Source |
|------|-----------|---------------|
| NFL | GameTailSection | `prediction.training_key \|\| prediction.unique_id` |
| CFB | GameTailSection | `prediction.training_key \|\| prediction.id` |
| Today in Sports (NFL) | Query | `game.home_away_unique` |
| Today in Sports (CFB) | Query | `game.training_key \|\| game.id` |

### Database Structure
```sql
-- game_tails table
CREATE TABLE game_tails (
  id uuid PRIMARY KEY,
  user_id uuid,
  game_unique_id text,  -- This must match the gameId format!
  sport text CHECK (sport IN ('nfl', 'cfb', 'mlb', 'nba', 'ncaab')),
  team_selection text CHECK (team_selection IN ('home', 'away')),
  pick_type text CHECK (pick_type IN ('moneyline', 'spread', 'over_under'))
);
```

## Testing
To verify the fix works:
1. Open browser console on Today in Sports page
2. Look for logs under "🎯 FETCHING TOP TAILED GAMES"
3. Check that both `nflTails` and `cfbTails` counts are > 0
4. Verify CFB games appear in "High Tailing It" section

## Console Debugging Output
The enhanced logging shows:
```
========================================
🎯 FETCHING TOP TAILED GAMES
========================================
Total gameIds: X
NFL game IDs: [...]
CFB game IDs: [...]

ALL TAILS in database: { total: X, nflCount: Y, cfbCount: Z }
Unique CFB game IDs in database: [...]
CFB game IDs we're looking for: [...]

Tails query result: { count: X, nflTails: Y, cfbTails: Z }
✅ Found X tails for week games
```

If CFB tails are missing, the logs will show:
```
⚠️ Missing some CFB tails: found 0, expected up to X
This suggests gameId mismatch between CFB page and Today in Sports
```

## Files Modified
- `src/pages/TodayInSports.tsx`
  - Fixed NFL gameId format (line 175)
  - Fixed CFB gameId format (line 286)
  - Added extensive debugging (lines 700-750)
  - Fixed profiles table name (line 725)
  - Improved pick type display formatting (lines 1006-1029)

