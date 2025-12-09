# ChatKit Context Debugging Guide

## What We Changed

### Problem
The AI wasn't receiving the game data context even though we were building and logging it correctly.

### Solution
We're now passing the system context in **TWO places** to ensure it gets through:

1. **In ChatKit Config** (when initializing)
   ```javascript
   const chatKitConfig = {
     thread: {
       messages: [
         { role: "system", content: systemMessage }
       ]
     }
   }
   ```

2. **Via control.createThread()** (after control is ready)
   ```javascript
   control.createThread({
     messages: [
       { role: "system", content: systemMessage }
     ]
   });
   ```

## What to Look For in Console

### 1. Page Data Summary (First)
You'll see a nicely formatted summary of the games:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏈 NFL - DATA SENT TO AI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 Total Games: 16

🏈 Game 1: Buffalo @ Kansas City
   📅 Date/Time: 1/26/2025 18:30:00
   📊 Lines: ...
   🤖 Model Predictions: ...
```

### 2. ChatKit Config Build
```
🔧 Building ChatKit config with system context:
  hasContext: true
  contextLength: 5234
  systemMessageLength: 5400
```

### 3. Thread Creation (MOST IMPORTANT)
When you open the chat, look for this orange banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 CREATING NEW CHATKIT THREAD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 System Message Being Sent:

You are WagerBot, an expert sports betting analyst. You have access to detailed game data and predictions for the games the user is currently viewing.

## NFL Games Data (16 total games)

Game 1: Buffalo @ Kansas City
- Date/Time: 1/26/2025 18:30:00
- Lines:
  * Spread: Kansas City -2.5
  * Moneyline: Away +120 / Home -145
  * Over/Under: 48.5
- Model Predictions:
  * ML Probability: 58.3%
  * Spread Cover Prob: 54.2%
  * O/U Probability: 62.1%
... (continues with all games)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Thread creation called successfully
Thread object returned: [object]
✅ Thread initialized with page-specific context
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Testing Steps

1. **Open browser console** (F12)
2. **Navigate to NFL or College Football page**
3. **Look for the colored data summary** - this shows what we're preparing
4. **Click the chat button** to open MiniWagerBot
5. **Look for the orange "🔥 CREATING NEW CHATKIT THREAD" banner**
6. **Read the full system message** that's displayed - it should contain ALL your game data
7. **Ask the AI a specific question** about a game, like:
   - "What's the spread for the Buffalo vs Kansas City game?"
   - "Which team does the model favor in Game 1?"
   - "Tell me about the weather conditions"

## What If It Still Doesn't Work?

If you see the thread being created with all the data BUT the AI still doesn't know about it, the issue might be:

### 🔴 Issue 1: ChatKit Not Using Our Thread
ChatKit might be managing threads automatically and ignoring our `createThread()` call.

**Solution:** We need to check your BuildShip workflow and see if we can pass the system context there instead.

### 🔴 Issue 2: Thread Gets Recreated
ChatKit might be creating a new thread without the system message after our initialization.

**Solution:** We may need to use a different ChatKit approach or pass context per message.

### 🔴 Issue 3: BuildShip Agent Has Instructions
Your BuildShip workflow might have its own agent instructions that override our system message.

**Solution:** Check BuildShip workflow settings and ensure agent instructions allow dynamic context.

## Next Steps If Still Failing

1. **Check BuildShip Logs** - See what's actually being sent to OpenAI
2. **Verify Agent Configuration** - Make sure agent allows system messages
3. **Try Alternative Approach** - Pass context as the first user message instead
4. **Use BuildShip Parameters** - Pass context to BuildShip workflow, not ChatKit

## Copy This Test Message

Try asking the AI this exact question after opening the chat:

```
Can you list all the games you have data for? For each game, tell me the spread and which team the model favors.
```

If it can answer this with specific teams and numbers, the context IS working! ✅

If it gives generic responses or says it doesn't have that data, the context is NOT working. ❌

