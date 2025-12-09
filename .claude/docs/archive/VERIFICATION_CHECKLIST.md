# System Prompt Fix - Verification Checklist

## Quick Test Guide

### Step 1: Check Visual Indicator
Open the mobile app and navigate to the Chat tab. You should see:

**🟢 Green Dot** next to "WagerBot" title if game data is loaded
- Tap the dot to see: "Game Data Active - I have access to today's betting lines, predictions, and game data!"

**⚪ Gray Dot** if no game data is available
- Tap the dot to see: "No Game Data - No games available for today. I can still help with general betting questions."

**Loading Spinner** while fetching data (briefly on load)

### Step 2: Check Console on App Launch
You should see in console:

```
🔄 Loading game context for WagerBot...
🔄 Fetching game data for AI context...
📊 Fetched predictions:
   - NFL: X games
   - CFB: Y games
📝 Formatted contexts:
   - NFL context: XXXX chars
   - CFB context: YYYY chars
✅ Game context generated: ZZZZ characters
📊 Total games: X NFL + Y CFB
📄 Context preview (first 200 chars): # 🏈 NFL Games Data...
✅ Game context loaded successfully
📊 Context length: ZZZZ characters
📊 Context preview (first 300 chars): # 🏈 NFL Games Data...
```

### Step 3: Send Test Message
Send this message: **"What games are today?"**

Check the console for:
```
📦 REQUEST PAYLOAD TO BUILDSHIP (RESPONSES API)
Payload structure:
  - message: "What games are today?"
  - message type: string
  - conversationHistory: EMPTY
  - SystemPrompt: (XXXX chars)  ← Should be > 1000

📊 SYSTEM PROMPT CONTENT PREVIEW:
First 500 chars: # 🏈 NFL Games Data

I have access to **14 NFL games** with complete betting lines...
```

### Step 4: Verify AI Response
The AI should respond with specific game details like:
- Team names
- Game times
- Betting lines
- Predictions

❌ **Bad Response (Not Fixed):**
> "I don't have access to today's game schedule. Please check..."

✅ **Good Response (Fixed):**
> "Today we have 14 NFL games and 25 College Football games. Here are some highlights:
> 
> **NFL:**
> - Chiefs @ Bills (1:00 PM) - Bills favored by -3.5
> - Cowboys @ Eagles (4:25 PM) - Eagles -6
> ..."

## What Was Changed

### Files Modified:
1. ✅ `/services/supabase.ts` - Added dual database configuration
2. ✅ `/services/gameDataService.ts` - Now uses collegeFootballSupabase
3. ✅ `/components/WagerBotChat.tsx` - Enhanced logging for SystemPrompt
4. ✅ `/app/(tabs)/chat.tsx` - Enhanced logging for context loading

### Key Changes:
- Split Supabase client into two instances (main + college football)
- Fixed data fetching to use correct database
- Added comprehensive logging at every stage
- Better error handling and user feedback

## Common Issues & Solutions

### Issue: "No game data available at this time"
**Cause:** No predictions in database for today's date
**Solution:** Check if there are games scheduled for today in the database

### Issue: Context length is 0
**Causes:**
1. Database connection failed
2. No data for today's date
3. Wrong database being queried (check supabase URL)

**Debug:**
```javascript
// Check database directly
const { data, error } = await collegeFootballSupabase
  .from('nfl_predictions_epa')
  .select('count');
console.log('NFL predictions count:', data, error);
```

### Issue: SystemPrompt: NOT_PRESENT
**Cause:** gameContext prop is empty or undefined
**Check:**
1. Is `fetchAndFormatGameContext()` returning data?
2. Is context loading before message is sent?
3. Check console for "Game context loaded successfully"

## Performance Expectations

- **Context Loading Time:** 1-3 seconds
- **Context Size:** 3000-10000 characters (depending on number of games)
- **Database Queries:** 4 total (NFL predictions, NFL lines, CFB predictions, CFB API data)
- **Message Send Time:** 2-5 seconds for AI response

## Testing Different Scenarios

### Test 1: General Question
**Message:** "What games should I bet on today?"
**Expected:** AI provides recommendations based on model predictions

### Test 2: Specific Team
**Message:** "What's the spread for the Cowboys game?"
**Expected:** AI provides exact betting line for Cowboys game

### Test 3: Betting Analysis
**Message:** "Which games have the best value according to your model?"
**Expected:** AI analyzes predictions vs. betting lines and recommends value bets

### Test 4: Weather Impact
**Message:** "Are any games affected by weather?"
**Expected:** AI mentions games with high wind or precipitation

### Test 5: Public Betting
**Message:** "Where is the public betting heavy?"
**Expected:** AI mentions games with lopsided public betting splits

## Success Criteria

✅ **Fix is successful if:**
1. **🟢 Green dot appears** next to WagerBot title when data is loaded
2. Console logs show game data being fetched (X NFL + Y CFB games)
3. Context length > 1000 characters
4. SystemPrompt is included in request payload
5. AI responses reference specific games and betting lines
6. User can ask questions about specific teams and get accurate answers
7. Tapping the green dot shows "Game Data Active" alert

❌ **Fix failed if:**
1. Context length = 0
2. SystemPrompt: NOT_PRESENT
3. AI says "I don't have access to game data"
4. AI provides generic betting advice without specific games

## Next Steps After Verification

Once verified working:
1. Test on both iOS and Android
2. Test with different account types (free vs. premium)
3. Test error handling (disable network, etc.)
4. Test refresh functionality (pull-to-refresh)
5. Monitor console logs for any errors over extended use

## Rollback Plan

If issues occur, revert these commits:
- supabase.ts configuration change
- gameDataService.ts import change
- Enhanced logging in WagerBotChat.tsx and chat.tsx

## Support

If the fix doesn't work:
1. Check console logs - share full log output
2. Verify database has data for today
3. Test database connection directly
4. Check Supabase dashboard for API limits/errors
5. Verify BuildShip endpoint is receiving SystemPrompt

---

**Date Fixed:** October 22, 2025
**Issue ID:** System Prompt Not Sending Full Model Predictions
**Developer:** AI Assistant

