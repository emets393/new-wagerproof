# System Prompt Integration with BuildShip ✅

## Overview

The mobile WagerBot now sends game data as a `SystemPrompt` parameter to BuildShip with **every message**. This allows BuildShip to include fresh game context in each AI request.

## What's Being Sent

### Request Body Structure

Every message sent to BuildShip now includes:

```json
{
  "message": "User's message text",
  "conversationId": "conv_abc123",  // Optional, for context
  "SystemPrompt": "# 🏈 NFL Games Data\n\nI have access to **16 NFL games**..."
}
```

### SystemPrompt Content

The `SystemPrompt` parameter contains the full game data context formatted as markdown:

```markdown
# 🏈 NFL Games Data

I have access to **16 NFL games** with complete betting lines, model predictions, weather data, and public betting splits.

### Game 1: Buffalo Bills @ Kansas City Chiefs

**Date/Time:** 10/22/2025

**Betting Lines:**
- Spread: Kansas City Chiefs -3.0
- Moneyline: Away +155 / Home -180
- Over/Under: 47.5

**Model Predictions (EPA Model):**
- ML Probability: 62.5%
- Spread Cover Probability: 58.3%
- O/U Probability: 54.2%

**Weather:** 72°F, Wind: 8 mph

**Public Betting Splits:**
- Spread: 65% on Chiefs
- Total: 58% on Over
- Moneyline: 70% on Chiefs

---

### Game 2: ...
[Additional games follow same format]

# 🏈 College Football Games Data
[CFB games in same format]
```

### Data Included Per Game

For each game, the SystemPrompt includes:
- ✅ Team names (away @ home)
- ✅ Game date and time
- ✅ Betting lines (spread, moneyline, over/under)
- ✅ Model predictions (ML prob, spread cover prob, O/U prob)
- ✅ Predicted scores (CFB only)
- ✅ Weather data (temperature, wind speed, precipitation)
- ✅ Public betting splits (spread, total, moneyline)

## Console Logs

When sending a message, you'll see:

```
📤 Sending message to BuildShip...
📦 Request body: { 
  message: "Tell me about today's games", 
  hasConversationId: false,
  systemPromptLength: 12456 
}
```

The `systemPromptLength` shows how many characters of game data are being sent.

## BuildShip Configuration

### 1. Add SystemPrompt Input

In your BuildShip workflow, add a new input parameter:

**Input Schema:**
```json
{
  "message": {
    "type": "string",
    "required": true
  },
  "conversationId": {
    "type": "string",
    "required": false
  },
  "SystemPrompt": {
    "type": "string",
    "required": false,
    "description": "Game data context for the AI"
  }
}
```

### 2. Use SystemPrompt in OpenAI Call

When calling OpenAI, structure your messages array like this:

```javascript
const messages = [
  {
    role: "system",
    content: request.body.SystemPrompt || "You are WagerBot, an expert sports betting analyst."
  },
  // ... conversation history (if conversationId exists)
  {
    role: "user",
    content: request.body.message
  }
];

// Call OpenAI with these messages
const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: messages,
  stream: true
});
```

### 3. Alternative: Append to System Message

If you already have a base system prompt:

```javascript
const basePrompt = "You are WagerBot, an expert sports betting analyst specialized in NFL and College Football.";

const systemPrompt = request.body.SystemPrompt 
  ? `${basePrompt}\n\n${request.body.SystemPrompt}\n\nUse this data to provide insightful analysis and answer questions about specific matchups.`
  : basePrompt;

const messages = [
  { role: "system", content: systemPrompt },
  // ... rest of messages
];
```

## Why Send with Every Message?

### Benefits

1. **Always Fresh Data**
   - Game data updates throughout the day
   - Each message gets the latest lines and predictions
   - No stale information

2. **No Session Dependency**
   - Works even if conversation history is lost
   - Doesn't rely on session initialization
   - More reliable

3. **Context Continuity**
   - AI always has access to game data
   - Can reference specific games in follow-ups
   - Better multi-turn conversations

### Token Considerations

**Typical SystemPrompt size:**
- ~10,000 characters for 20 games (NFL + CFB)
- ~2,500 tokens (GPT-4 tokenization)

**Cost per message with GPT-4:**
- System prompt: 2,500 tokens × $0.03/1K = $0.075
- User message: ~50 tokens × $0.03/1K = $0.0015
- Response: ~200 tokens × $0.06/1K = $0.012
- **Total: ~$0.089 per message**

**Optimization options:**
1. Use GPT-3.5-turbo (10x cheaper)
2. Limit to 10 games instead of 20
3. Cache system prompt in BuildShip for X minutes
4. Only send SystemPrompt on first message, rely on conversationId after

## Testing

### Verify SystemPrompt is Sent

1. **Check console logs:**
   ```
   📦 Request body: { 
     message: "...", 
     systemPromptLength: 12456  // ✅ Should be > 0
   }
   ```

2. **Check BuildShip logs:**
   - Look for incoming `SystemPrompt` parameter
   - Verify it contains game data
   - Check it's being used in OpenAI call

3. **Test AI responses:**
   - Ask: "What games are today?"
   - Should list actual games from context
   - Ask: "What's the weather for the Chiefs game?"
   - Should reference actual weather data

### Example Test Conversation

**User:** "What games do you have access to?"

**Expected AI Response:**
```
I have access to 16 NFL games and 8 College Football games today, including:

NFL:
- Buffalo Bills @ Kansas City Chiefs (6:30 PM)
- Dallas Cowboys @ San Francisco 49ers (8:15 PM)
...

Let me know which games you'd like to know more about!
```

**User:** "Tell me about the Chiefs game"

**Expected AI Response:**
```
The Kansas City Chiefs are hosting the Buffalo Bills today at 6:30 PM.

Betting Lines:
- Chiefs favored by 3 points
- Over/Under: 47.5
- Moneyline: Chiefs -180, Bills +155

Model Predictions:
- Chiefs have a 62.5% chance to win
- 58.3% probability they cover the spread
- 54.2% chance the total goes over

Weather: Pleasant conditions at 72°F with light winds at 8 mph

Public Betting: The public is heavily on the Chiefs with 65% of spread bets and 70% of moneyline action.

This looks like a solid Chiefs win, but the Bills have been...
```

## Troubleshooting

### Issue: AI doesn't reference game data

**Check:**
1. Console log shows `systemPromptLength: 0` → Game data not loaded
2. BuildShip not receiving SystemPrompt → Check input schema
3. BuildShip not using SystemPrompt → Check OpenAI messages array

**Solution:**
- Verify game data loads on chat screen (check console)
- Add SystemPrompt to BuildShip workflow inputs
- Use SystemPrompt in system message to OpenAI

### Issue: SystemPrompt too large

**Symptoms:** 
- Slow responses
- High costs
- 413 Payload Too Large errors

**Solution:**
1. Reduce games from 20 to 10:
   ```typescript
   const contextParts = predictions.slice(0, 10) // Instead of 20
   ```

2. Remove some fields:
   - Skip weather if not needed
   - Skip public betting splits
   - Only include key predictions

3. Compress format:
   - Use shorter field names
   - Remove markdown formatting
   - Use JSON instead of markdown

### Issue: Empty SystemPrompt

**Symptoms:**
- `systemPromptLength: 0` in logs
- AI has no game knowledge

**Cause:**
- Game data failed to load
- No games available for today
- Error in data fetching

**Solution:**
- Check earlier console logs for game data errors
- Verify Supabase tables have data
- Test game data service independently

## Performance Monitoring

Monitor these metrics:

1. **SystemPrompt Size:**
   - Target: 10,000-15,000 characters
   - Alert if > 20,000 (too large)
   - Alert if < 1,000 (too small/missing)

2. **Response Times:**
   - With SystemPrompt: 3-5 seconds typical
   - Without: 2-3 seconds
   - Alert if > 10 seconds

3. **OpenAI Token Usage:**
   - Track input tokens (system + user)
   - Track output tokens (response)
   - Set budgets if needed

4. **Error Rates:**
   - 413 errors → SystemPrompt too large
   - Timeouts → Complex queries + large context
   - Empty responses → SystemPrompt formatting issue

## Future Optimizations

### 1. Smart Context Selection
Only include games the user asks about:
```typescript
// Instead of all games, filter based on query
if (message.includes("Chiefs")) {
  // Only send Chiefs game data
}
```

### 2. Context Caching
Cache SystemPrompt in BuildShip for 5 minutes:
```javascript
const cachedContext = cache.get(`context:${userId}`);
const systemPrompt = cachedContext || request.body.SystemPrompt;
if (!cachedContext) {
  cache.set(`context:${userId}`, systemPrompt, 300); // 5 min
}
```

### 3. Incremental Updates
Send full context first, then only updates:
```json
{
  "message": "...",
  "conversationId": "conv_123",
  "contextUpdate": {
    "updatedGames": ["Chiefs game"],
    "newOdds": {...}
  }
}
```

### 4. Compressed Format
Use JSON instead of markdown:
```json
{
  "games": [
    {
      "id": "kc_buf",
      "away": "BUF",
      "home": "KC",
      "spread": -3,
      "ml": { "away": 155, "home": -180 },
      "total": 47.5,
      "predictions": { "ml": 0.625, "spread": 0.583, "total": 0.542 }
    }
  ]
}
```

## Summary

✅ **What Changed:**
- Added `SystemPrompt` parameter to all message requests
- Contains full game data formatted as markdown
- Sent with every message (not just session init)

✅ **BuildShip Needs:**
- Accept `SystemPrompt` input parameter (string)
- Use it as OpenAI system message
- Can append to base prompt or replace entirely

✅ **Benefits:**
- AI always has fresh game data
- No reliance on session state
- Better context-aware responses

✅ **Considerations:**
- ~2,500 tokens per message
- Monitor costs with GPT-4
- Can optimize by reducing games or using GPT-3.5

The mobile chat now provides complete game context to BuildShip with every message! 🎉

