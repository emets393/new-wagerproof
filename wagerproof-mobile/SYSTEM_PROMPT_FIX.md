# WagerBot Mobile System Prompt Fix

## Issue
The WagerBot mobile app was not sending the full model predictions and game data as a system prompt to the AI. The AI was responding without knowledge of today's games, betting lines, and predictions.

## Root Cause
The mobile app was using a single Supabase client that wasn't properly configured, while the web app uses **two separate Supabase instances**:

1. **Main Supabase** (`gnjrklxotmbvnxbnnqgq`) - For authentication and chat threads
2. **College Football Supabase** (`jpxnjuwglavsjbgbasnl`) - For predictions and game data

The mobile app's `gameDataService.ts` was trying to fetch from the wrong database, resulting in empty data being passed to the AI.

## Changes Made

### 1. Updated Supabase Configuration (`services/supabase.ts`)
**Before:**
```typescript
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { ... },
});
```

**After:**
```typescript
// Main Supabase instance for auth and chat
const MAIN_SUPABASE_URL = "https://gnjrklxotmbvnxbnnqgq.supabase.co";
const MAIN_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

// College Football Supabase instance for predictions data
const COLLEGE_FOOTBALL_SUPABASE_URL = "https://jpxnjuwglavsjbgbasnl.supabase.co";
const COLLEGE_FOOTBALL_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

// Export both clients
export const supabase = createClient(MAIN_SUPABASE_URL, MAIN_SUPABASE_ANON_KEY, { ... });
export const collegeFootballSupabase = createClient(COLLEGE_FOOTBALL_SUPABASE_URL, COLLEGE_FOOTBALL_SUPABASE_ANON_KEY, { ... });
```

### 2. Updated Game Data Service (`services/gameDataService.ts`)
**Before:**
```typescript
import { supabase } from './supabase';
const collegeFootballSupabase = supabase; // Wrong database!
```

**After:**
```typescript
import { collegeFootballSupabase } from './supabase'; // Correct database!
```

### 3. Enhanced Logging

#### In `WagerBotChat.tsx`:
- Added detailed SystemPrompt content preview in console logs
- Shows first 500 chars and last 200 chars of context
- Warns if SystemPrompt is missing or empty

#### In `chat.tsx`:
- Logs context length and preview when loaded
- Warns if context is empty
- Shows error message to user if data fails to load

#### In `gameDataService.ts`:
- Logs number of NFL and CFB games fetched
- Logs character count of formatted contexts
- Warns if generated context is empty
- Shows preview of context content

## How It Works Now

1. **On Chat Screen Mount:**
   - `chat.tsx` calls `fetchAndFormatGameContext()`
   - This fetches NFL and CFB predictions from the correct database
   - Data is formatted as markdown with:
     - Game matchups
     - Betting lines (spread, moneyline, over/under)
     - Model predictions (probabilities)
     - Weather data
     - Public betting splits

2. **When User Sends Message:**
   - WagerBotChat receives the `gameContext` prop
   - Includes it in `requestBody.SystemPrompt`
   - Sends to BuildShip Responses API endpoint
   - AI receives full game context and can answer specific questions

## Verification Steps

To verify the fix is working:

1. **Open the mobile app and navigate to Chat tab**

2. **Check the console logs for:**
   ```
   🔄 Fetching game data for AI context...
   📊 Fetched predictions:
      - NFL: X games
      - CFB: Y games
   📝 Formatted contexts:
      - NFL context: XXXX chars
      - CFB context: YYYY chars
   ✅ Game context generated: ZZZZ characters
   📄 Context preview (first 200 chars): # 🏈 NFL Games Data...
   ```

3. **Send a test message like:**
   - "What games are today?"
   - "Which teams are favored?"
   - "Show me the best betting value"

4. **Check the request logs for:**
   ```
   📦 REQUEST PAYLOAD TO BUILDSHIP (RESPONSES API)
   Payload structure:
     - message: "What games are today?"
     - conversationHistory: X messages
     - SystemPrompt: (XXXX chars)  ← Should have a large character count
   
   📊 SYSTEM PROMPT CONTENT PREVIEW:
   First 500 chars: # 🏈 NFL Games Data
   
   I have access to **14 NFL games**...
   ```

## Expected Behavior After Fix

### ✅ Before (Broken):
- AI responds: "I don't have access to today's games"
- SystemPrompt: NOT_PRESENT
- Context length: 0 characters

### ✅ After (Fixed):
- AI responds with specific game details
- SystemPrompt: (5000+ chars)
- Context includes all games, lines, and predictions
- AI can answer questions about specific teams and matchups

## Testing Checklist

- [ ] Chat screen loads without errors
- [ ] Console shows "Fetched predictions: NFL: X games, CFB: Y games"
- [ ] Context length is > 1000 characters
- [ ] Sending message includes SystemPrompt in request
- [ ] AI responds with knowledge of today's games
- [ ] Can ask "What's the spread for [team]?" and get accurate answer
- [ ] Can ask "Which games have the best value?" and get recommendations

## Technical Details

### Database Schema
Both databases use the same table structure, but they're separate instances:

**NFL Predictions:**
- Table: `nfl_predictions_epa`
- Table: `nfl_betting_lines`

**CFB Predictions:**
- Table: `cfb_live_weekly_inputs`
- Table: `cfb_api_predictions`

### System Prompt Format
The SystemPrompt is formatted as markdown with this structure:
```markdown
# 🏈 NFL Games Data

I have access to **14 NFL games** with complete betting lines...

### Game 1: Chiefs @ Bills

**Date/Time:** 10/22/2025 1:00 PM

**Betting Lines:**
- Spread: Bills -3.5
- Moneyline: Away +150 / Home -180
- Over/Under: 47.5

**Model Predictions (EPA Model):**
- ML Probability: 58.3%
- Spread Cover Probability: 52.1%
- O/U Probability: 51.8%

**Weather:** 65°F, Wind: 8 mph

**Public Betting Splits:**
- Spread: 55% on Home
- Total: 52% on Over
- Moneyline: 58% on Home

---

[... repeated for all games ...]
```

## Related Files
- `/wagerproof-mobile/services/supabase.ts` - Supabase client configuration
- `/wagerproof-mobile/services/gameDataService.ts` - Fetches and formats game data
- `/wagerproof-mobile/app/(tabs)/chat.tsx` - Chat screen that loads context
- `/wagerproof-mobile/components/WagerBotChat.tsx` - Chat component that sends messages
- `/wagerproof-mobile/types/nfl.ts` - NFL prediction type definitions
- `/wagerproof-mobile/types/cfb.ts` - CFB prediction type definitions

## UI Indicator - Green Dot Status

### Visual Feedback
A small **green dot** appears next to the "WagerBot" title in the header to indicate game data status:

- **🟢 Green Dot** - Live game data is loaded and AI has access to predictions
- **⚪ Gray Dot** - No game data available (no games today or fetch failed)
- **Loading Spinner** - Game data is being fetched

### Interactive Feature
Users can **tap the dot** to see detailed status:
- "Game Data Active" - Shows when data is loaded
- "No Game Data" - Shows when no data is available

### Implementation
Located in `/app/(tabs)/chat.tsx`:
```typescript
{!isLoadingContext && (
  <TouchableOpacity onPress={() => { /* Show alert */ }}>
    <View style={[
      styles.dataIndicator,
      { backgroundColor: gameContext?.length > 0 ? '#22c55e' : '#94a3b8' }
    ]} />
  </TouchableOpacity>
)}
```

## Future Enhancements

1. **Add caching:** Cache the game context for 15-30 minutes to reduce database calls
2. **Add refresh button:** Allow user to manually refresh game data
3. ~~**Add context indicator:** Show icon in UI when context is loaded/empty~~ ✅ COMPLETE
4. ~~**Add loading state:** Show loading indicator while fetching context~~ ✅ COMPLETE
5. **Handle stale data:** Auto-refresh context if older than X minutes
6. **Error recovery:** Retry failed data fetches with exponential backoff
7. **Animated dot pulse:** Make the green dot pulse to draw attention
8. **Game count badge:** Show number of games available (e.g., "14 NFL, 25 CFB")

## Notes

- The system prompt can be quite large (5000-10000 characters) depending on number of games
- Limited to first 20 games per sport to manage token count
- Context is fetched once on screen mount - consider refresh on pull-to-refresh
- If no games are available, AI will work but without game-specific knowledge

